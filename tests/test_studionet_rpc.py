"""JSON-RPC adapter schema tests use fixtures and never contact StudioNet."""

import json

import pytest

from keeper.studionet_rpc import (
    STUDIONET_CHAIN_ID,
    StudioNetRPC,
    StudioNetRPCError,
)


PARENT = "0x" + "11" * 32
EXTERNAL = "0x" + "22" * 32
SOURCE = "0x" + "aa" * 20
DESTINATION = "0x" + "bb" * 20


def transport_for(method_results):
    requests = []

    def transport(url, payload, timeout):
        request = json.loads(payload)
        requests.append(request)
        result = method_results[request["method"]]
        if callable(result):
            result = result(request)
        return json.dumps({"jsonrpc": "2.0", "id": request["id"], "result": result}).encode()

    return transport, requests


def fixture_results():
    return {
        "eth_chainId": "0xf22f",
        "gen_getTransactionReceipt": lambda request: {
            "id": request["params"][0]["txId"],
            "statusName": "Finalized",
            "txExecutionResultName": "FinishedWithReturn",
        },
        "gen_getTransactionLifecycle": {"storedStatus": "Finalized"},
        "eth_getTransactionByHash": {
            "hash": EXTERNAL, "from": SOURCE, "to": DESTINATION, "value": "0x64",
        },
        "eth_getTransactionReceipt": {
            "transactionHash": EXTERNAL, "status": "0x1", "blockNumber": "0xa",
        },
        "eth_getBalance": lambda request: "0x10" if request["params"][1] == "0x9" else "0x74",
    }


def test_endpoint_is_pinned_to_studionet():
    with pytest.raises(ValueError, match="RPC endpoint"):
        StudioNetRPC("https://studio.genlayer.com/Bradbury")
    with pytest.raises(ValueError, match="RPC endpoint"):
        StudioNetRPC("https://example.com/api")
    with pytest.raises(ValueError, match="transaction ID"):
        StudioNetRPC(transport=lambda *_: b"{}").gen_transaction_receipt("bad")


def test_eoa_inspection_reads_full_transaction_fields_but_fails_closed_on_missing_parent_link():
    transport, requests = transport_for(fixture_results())
    rpc = StudioNetRPC(transport=transport)
    result = rpc.inspect_eoa_payment(
        transfer_id="payment-fixture",
        parent_tx_id=PARENT,
        external_tx_id=EXTERNAL,
        source_address=SOURCE,
        destination_address=DESTINATION,
        amount_wei=100,
    )
    assert result.chain_id == STUDIONET_CHAIN_ID
    assert result.external_status == "FINALIZED"
    assert result.observed_source_address == SOURCE
    assert result.observed_destination_address == DESTINATION
    assert result.observed_amount_wei == 100
    assert result.external_receipt_block == 10
    assert result.destination_balance_before_wei == 16
    assert result.destination_balance_after_wei == 116
    assert result.parent_child_link_verified is False
    assert result.reconciliation_state == "UNKNOWN"
    assert "causally linked" in result.reconciliation_reason
    assert all(request["method"] != "eth_sendRawTransaction" for request in requests)
    assert json.loads(result.to_json())["external_tx_id"] == EXTERNAL


def test_chain_mismatch_never_returns_receipt_data():
    results = fixture_results()
    results["eth_chainId"] = "0x539"
    transport, _ = transport_for(results)
    with pytest.raises(StudioNetRPCError, match="not StudioNet"):
        StudioNetRPC(transport=transport).inspect_eoa_payment(
            transfer_id="payment-fixture",
            parent_tx_id=PARENT,
            external_tx_id=EXTERNAL,
            source_address=SOURCE,
            destination_address=DESTINATION,
            amount_wei=100,
        )


def test_wrong_external_source_or_value_is_value_at_risk_even_without_parent_link():
    results = fixture_results()
    results["eth_getTransactionByHash"] = {
        "hash": EXTERNAL, "from": "0x" + "cc" * 20,
        "to": DESTINATION, "value": "0x63",
    }
    transport, _ = transport_for(results)
    result = StudioNetRPC(transport=transport).inspect_eoa_payment(
        transfer_id="payment-fixture",
        parent_tx_id=PARENT,
        external_tx_id=EXTERNAL,
        source_address=SOURCE,
        destination_address=DESTINATION,
        amount_wei=100,
    )
    assert result.reconciliation_state == "VALUE_AT_RISK"


def test_failed_external_receipt_is_recorded_as_failed_without_retry():
    results = fixture_results()
    results["eth_getTransactionReceipt"] = {
        "transactionHash": EXTERNAL, "status": "0x0", "blockNumber": "0xa",
    }
    transport, requests = transport_for(results)
    result = StudioNetRPC(transport=transport).inspect_eoa_payment(
        transfer_id="payment-fixture",
        parent_tx_id=PARENT,
        external_tx_id=EXTERNAL,
        source_address=SOURCE,
        destination_address=DESTINATION,
        amount_wei=100,
    )
    assert result.external_status == "FAILED"
    assert result.reconciliation_state == "CHILD_FAILED"
    assert all(request["method"] != "eth_sendRawTransaction" for request in requests)


def test_external_transfer_without_receipt_remains_pending():
    results = fixture_results()
    results["eth_getTransactionReceipt"] = None
    transport, _ = transport_for(results)
    result = StudioNetRPC(transport=transport).inspect_eoa_payment(
        transfer_id="payment-fixture",
        parent_tx_id=PARENT,
        external_tx_id=EXTERNAL,
        source_address=SOURCE,
        destination_address=DESTINATION,
        amount_wei=100,
    )
    assert result.external_status == "PENDING"
    assert result.reconciliation_state == "PENDING"
