from copy import deepcopy

from keeper.archive import ReceiptArchive, Watch
from keeper.monitor import Monitor


PARENT = "0x" + "1" * 64
CHILD = "0x" + "2" * 64
OTHER_CHILD = "0x" + "3" * 64
SOURCE = "0x" + "a" * 40
DESTINATION = "0x" + "b" * 40
AMOUNT = 1000


def watch(kind="IC"):
    return Watch(
        tx_id=PARENT,
        transfer_id="transfer-1",
        source_address=SOURCE,
        destination_address=DESTINATION,
        amount_wei=AMOUNT,
        recipient_kind=kind,
        destination_contract=DESTINATION if kind == "IC" else "",
        destination_method="get_allocation_amount" if kind == "IC" else "",
        destination_args_json='["allocation-1"]',
    )


def parent(status="FINALIZED", message_type="internal", result="FINISHED_WITH_RETURN"):
    return {
        "tx_id": PARENT,
        "status_name": status,
        "tx_execution_result_name": result,
        "messages": [{
            "message_type": message_type,
            "recipient": DESTINATION,
            "value": AMOUNT,
            "on_acceptance": False,
            "data": "0x",
        }],
    }


def child(status="FINALIZED", recipient=DESTINATION, sender=SOURCE, value=AMOUNT, result="FINISHED_WITH_RETURN"):
    return {
        "tx_id": CHILD,
        "status_name": status,
        "tx_execution_result_name": result,
        "sender": sender,
        "recipient": recipient,
        "fees": {"user_value": value},
    }


class FakeReader:
    def __init__(self):
        self.parent_tx = parent(status="PENDING")
        self.child_tx = child()
        self.children = [CHILD]
        self.balance_calls = {SOURCE: 0, DESTINATION: 0}
        self.source_values = [10_000, 9_000]
        self.destination_values = [20_000, 21_000]
        self.contract_value = AMOUNT
        self.fail_parent = False

    def verify_chain(self):
        return "0xf22f"

    def get_transaction(self, tx_id):
        if tx_id == PARENT:
            if self.fail_parent:
                raise TimeoutError("temporary transport failure")
            return deepcopy(self.parent_tx)
        if tx_id == CHILD:
            return deepcopy(self.child_tx)
        return {"tx_id": tx_id, "status_name": "FINALIZED", "tx_execution_result_name": "FINISHED_WITH_RETURN"}

    def get_lifecycle(self, tx_id):
        return {"stored_status": "Finalized" if tx_id != PARENT else self.parent_tx["status_name"]}

    def get_triggered_transaction_ids(self, tx_id):
        return list(self.children)

    def get_balance(self, address):
        index = min(self.balance_calls[address], len(self.source_values) - 1)
        result = self.source_values[index] if address == SOURCE else self.destination_values[index]
        self.balance_calls[address] += 1
        return result

    def read_contract(self, address, function_name, args):
        return self.contract_value


def test_archive_survives_restart_and_deduplicates_identical_receipts_and_alerts(tmp_path):
    path = tmp_path / "keeper.sqlite3"
    first = ReceiptArchive(path)
    assert first.track(watch()) is True
    assert first.append_receipt(PARENT, "parent_receipt", {"status": "Pending"}) is True
    first.alert(PARENT, "UNKNOWN", "WARNING", "same issue")
    first.add_edge(PARENT, CHILD, "internal_message_child", "sdk")

    reopened = ReceiptArchive(path)
    assert reopened.track(watch()) is False
    assert reopened.append_receipt(PARENT, "parent_receipt", {"status": "Pending"}) is False
    reopened.alert(PARENT, "UNKNOWN", "WARNING", "same issue")
    assert reopened.add_edge(PARENT, CHILD, "internal_message_child", "sdk") is False
    report = reopened.report()
    assert len(report["watches"]) == 1
    assert len(report["alerts"]) == 1
    assert report["alerts"][0]["occurrences"] == 1
    assert report["spending_authority"] is False
    assert report["automatic_retry"] is False


def test_internal_child_is_verified_only_after_link_receipt_readback_and_two_sided_balances(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch())
    reader = FakeReader()
    monitor = Monitor(archive, reader)
    assert monitor.poll_once(PARENT)["state"] == "PENDING"

    reader.parent_tx = parent(status="FINALIZED")
    result = monitor.poll_once(PARENT)
    assert result["state"] == "VERIFIED"
    report = archive.report()
    assert report["transaction_edges"][0]["child_tx_id"] == CHILD
    assert report["watches"][0]["state"] == "VERIFIED"


def test_eoa_intent_and_matching_balance_observations_do_not_prove_external_execution(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch("EOA"))
    reader = FakeReader()
    reader.parent_tx = parent(status="FINALIZED", message_type="external")
    # The GenLayerPY triggered-transaction endpoint reports an unrelated
    # internal child; it cannot be attached to the EOA transfer.
    reader.children = [OTHER_CHILD]
    result = Monitor(archive, reader).poll_once(PARENT)
    assert result["state"] == "UNKNOWN"
    assert "external EOA execution" in result["reason"]
    assert archive.report()["watches"][0]["state"] == "UNKNOWN"


def test_failed_child_is_not_reported_as_paid(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch())
    reader = FakeReader()
    reader.parent_tx = parent(status="PENDING")
    monitor = Monitor(archive, reader)
    assert monitor.poll_once(PARENT)["state"] == "PENDING"
    reader.parent_tx = parent(status="FINALIZED")
    reader.child_tx = child(status="FINALIZED", result="FINISHED_WITH_ERROR")
    result = monitor.poll_once(PARENT)
    assert result["state"] == "CHILD_FAILED"
    assert result["state"] != "VERIFIED"


def test_incorrect_child_recipient_is_not_matched_from_the_parent_link(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch())
    reader = FakeReader()
    reader.parent_tx = parent(status="PENDING")
    monitor = Monitor(archive, reader)
    monitor.poll_once(PARENT)
    reader.parent_tx = parent(status="FINALIZED")
    reader.child_tx = child(recipient="0x" + "c" * 40)
    result = monitor.poll_once(PARENT)
    assert result["state"] == "UNKNOWN"


def test_inconsistent_balance_delta_is_value_at_risk(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch())
    reader = FakeReader()
    reader.parent_tx = parent(status="PENDING")
    monitor = Monitor(archive, reader)
    monitor.poll_once(PARENT)
    reader.parent_tx = parent(status="FINALIZED")
    reader.destination_values[-1] = 20_999
    result = monitor.poll_once(PARENT)
    assert result["state"] == "VALUE_AT_RISK"
    assert "destination balance delta" in result["reason"]


def test_rpc_failure_is_archived_as_unknown_and_next_poll_recovers(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch())
    reader = FakeReader()
    reader.parent_tx = parent(status="PENDING")
    reader.fail_parent = True
    monitor = Monitor(archive, reader)
    failed = monitor.poll_once(PARENT)
    assert failed["state"] == "UNKNOWN"
    assert archive.get_watch(PARENT)["last_error"] == "read/reconciliation failure: TimeoutError"
    reader.fail_parent = False
    assert monitor.poll_once(PARENT)["state"] == "PENDING"


def test_finalized_parent_with_wrong_or_missing_message_fails_closed(tmp_path):
    archive = ReceiptArchive(tmp_path / "keeper.sqlite3")
    archive.track(watch())
    reader = FakeReader()
    reader.parent_tx = parent(status="FINALIZED")
    reader.parent_tx["messages"][0]["value"] = AMOUNT + 1
    result = Monitor(archive, reader).poll_once(PARENT)
    assert result["state"] == "VALUE_AT_RISK"
