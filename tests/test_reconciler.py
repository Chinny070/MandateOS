"""Deterministic tests of receipt-state reduction; values below are fixtures."""

import pytest

from keeper.reconciler import TransferObservation, TransferState, reconcile_transfer


def observation(**changes):
    values = dict(
        transfer_id="allocation-fixture-only",
        amount_wei=25,
        parent_tx_id="parent-fixture-only",
        parent_status="FINALIZED",
        child_tx_id="child-fixture-only",
        child_status="FINALIZED",
        expected_source_address="0x" + "11" * 20,
        expected_destination_address="0x" + "22" * 20,
        observed_source_address="0x" + "11" * 20,
        observed_destination_address="0x" + "22" * 20,
        child_amount_wei=25,
        parent_child_link_verified=True,
        destination_balance_before_wei=100,
        destination_balance_after_wei=125,
        destination_recorded_amount_wei=25,
    )
    values.update(changes)
    return TransferObservation(**values)


def test_matching_parent_child_destination_and_balances_verify():
    result = reconcile_transfer(observation())
    assert result.state == TransferState.VERIFIED
    assert result.retry_permitted is False


@pytest.mark.parametrize(
    "changes,expected",
    [
        ({"parent_status": "ACCEPTED"}, TransferState.PENDING),
        ({"parent_status": "FAILED"}, TransferState.PARENT_FAILED),
        ({"child_tx_id": None, "child_status": None}, TransferState.UNKNOWN),
        ({"child_status": "ACCEPTED"}, TransferState.PENDING),
        ({"child_status": "FAILED"}, TransferState.CHILD_FAILED),
        ({"destination_recorded_amount_wei": None}, TransferState.CHILD_SUCCESS),
        ({"destination_balance_after_wei": None}, TransferState.CHILD_SUCCESS),
        ({"destination_recorded_amount_wei": 24}, TransferState.VALUE_AT_RISK),
        ({"destination_balance_after_wei": 124}, TransferState.VALUE_AT_RISK),
        ({"parent_status": "mystery"}, TransferState.UNKNOWN),
    ],
)
def test_incomplete_or_failed_receipt_paths_fail_closed(changes, expected):
    result = reconcile_transfer(observation(**changes))
    assert result.state == expected
    assert not result.retry_permitted


def test_missing_identity_and_ids_are_unknown():
    assert reconcile_transfer(observation(parent_tx_id=None)).state == TransferState.UNKNOWN
    assert reconcile_transfer(observation(transfer_id="")).state == TransferState.UNKNOWN
    assert reconcile_transfer(observation(amount_wei=0)).state == TransferState.UNKNOWN


def test_child_receipt_without_parent_causality_is_never_verified():
    result = reconcile_transfer(observation(parent_child_link_verified=False))
    assert result.state == TransferState.UNKNOWN
    assert "causally linked" in result.reason
    assert not result.retry_permitted


@pytest.mark.parametrize(
    "changes",
    [
        {"observed_source_address": "0x" + "33" * 20},
        {"observed_destination_address": "0x" + "44" * 20},
        {"child_amount_wei": 24},
    ],
)
def test_recipient_or_amount_mismatch_is_value_at_risk(changes):
    result = reconcile_transfer(observation(**changes))
    assert result.state == TransferState.VALUE_AT_RISK
    assert not result.retry_permitted


def test_eoa_requires_receipt_balance_and_parent_link():
    values = observation(recipient_kind="EOA", destination_recorded_amount_wei=None)
    assert reconcile_transfer(values).state == TransferState.VERIFIED
    without_balance = observation(
        recipient_kind="EOA", destination_recorded_amount_wei=None,
        destination_balance_after_wei=None,
    )
    assert reconcile_transfer(without_balance).state == TransferState.CHILD_SUCCESS
