"""Read-only StudioNet receipt inspection.

The adapter deliberately does not sign, submit, retry, or mutate transactions.
StudioNet's documented GenLayer receipt schema does not link an EVM external
transfer hash back to the originating IC message, so EOA observations remain
UNKNOWN until that causal link can be independently established.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from typing import Any, Callable

from keeper.reconciler import TransferObservation, reconcile_transfer


STUDIONET_RPC_URL = "https://studio.genlayer.com/api"
STUDIONET_CHAIN_ID = "0xf22f"


class StudioNetRPCError(RuntimeError):
    """Raised when the read-only StudioNet RPC result is unavailable or invalid."""


Transport = Callable[[str, bytes, float], bytes]


def _https_transport(url: str, body: bytes, timeout: float) -> bytes:
    request = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise StudioNetRPCError(f"StudioNet RPC returned HTTP {response.status}")
            return response.read(2_000_001)
    except HTTPError as error:
        raise StudioNetRPCError(f"StudioNet RPC returned HTTP {error.code}") from None
    except (URLError, TimeoutError, OSError) as error:
        raise StudioNetRPCError(f"StudioNet RPC transport error: {type(error).__name__}") from None


@dataclass(frozen=True)
class EoaPaymentInspection:
    chain_id: str
    transfer_id: str
    parent_tx_id: str
    external_tx_id: str
    expected_source_address: str
    expected_destination_address: str
    amount_wei: int
    parent_status: str
    parent_execution_result: str | None
    external_status: str
    observed_source_address: str | None
    observed_destination_address: str | None
    observed_amount_wei: int | None
    external_receipt_block: int | None
    destination_balance_before_wei: int | None
    destination_balance_after_wei: int | None
    parent_child_link_verified: bool
    reconciliation_state: str
    reconciliation_reason: str

    def to_json(self) -> str:
        """Serialize a sanitized receipt record without keys or request headers."""
        return json.dumps(asdict(self), sort_keys=True, separators=(",", ":"))


class StudioNetRPC:
    """Small read-only JSON-RPC client pinned to the StudioNet endpoint."""

    def __init__(
        self,
        endpoint: str = STUDIONET_RPC_URL,
        *,
        timeout: float = 15.0,
        transport: Transport | None = None,
    ) -> None:
        parsed = urlparse(endpoint)
        if (parsed.scheme != "https" or parsed.hostname != "studio.genlayer.com"
                or parsed.netloc.lower() != "studio.genlayer.com"
                or parsed.path.rstrip("/") != "/api" or parsed.query or parsed.fragment
                or parsed.username or parsed.password):
            raise ValueError("RPC endpoint must be https://studio.genlayer.com/api")
        if timeout <= 0 or timeout > 60:
            raise ValueError("RPC timeout must be between 0 and 60 seconds")
        self.endpoint = endpoint.rstrip("/")
        self.timeout = timeout
        self._transport = transport or _https_transport
        self._request_id = 0
        self._chain_verified = False

    def call(self, method: str, params: list[Any]) -> Any:
        self._request_id += 1
        request_id = self._request_id
        payload = json.dumps({
            "jsonrpc": "2.0", "method": method, "params": params, "id": request_id,
        }, separators=(",", ":")).encode("utf-8")
        raw = self._transport(self.endpoint, payload, self.timeout)
        if len(raw) > 2_000_000:
            raise StudioNetRPCError("StudioNet RPC response exceeds size limit")
        try:
            response = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise StudioNetRPCError("StudioNet RPC returned invalid JSON") from None
        if not isinstance(response, dict) or response.get("id") != request_id:
            raise StudioNetRPCError("StudioNet RPC response identity mismatch")
        if response.get("error") is not None:
            raise StudioNetRPCError("StudioNet RPC returned a JSON-RPC error")
        if "result" not in response:
            raise StudioNetRPCError("StudioNet RPC response omitted result")
        return response["result"]

    def verify_chain(self) -> str:
        chain_id = self.call("eth_chainId", [])
        if not isinstance(chain_id, str) or chain_id.lower() != STUDIONET_CHAIN_ID:
            raise StudioNetRPCError("RPC endpoint is not StudioNet chain ID 61999")
        self._chain_verified = True
        return chain_id.lower()

    @staticmethod
    def _transaction_hash(value: str) -> str:
        if (not isinstance(value, str) or len(value) != 66 or not value.startswith("0x")
                or any(character not in "0123456789abcdefABCDEF" for character in value[2:])):
            raise ValueError("transaction ID must be a 32-byte hex hash")
        return value.lower()

    def gen_transaction_receipt(self, tx_id: str) -> dict[str, Any]:
        tx_id = self._transaction_hash(tx_id)
        self._require_chain()
        receipt = self.call("gen_getTransactionReceipt", [{"txId": tx_id}])
        if not isinstance(receipt, dict) or str(receipt.get("id", "")).lower() != tx_id:
            raise StudioNetRPCError("GenLayer receipt is missing or has a different transaction ID")
        return receipt

    def gen_transaction_lifecycle(self, tx_id: str) -> dict[str, Any]:
        tx_id = self._transaction_hash(tx_id)
        self._require_chain()
        lifecycle = self.call("gen_getTransactionLifecycle", [{"txId": tx_id}])
        if not isinstance(lifecycle, dict) or not isinstance(lifecycle.get("storedStatus"), str):
            raise StudioNetRPCError("GenLayer transaction lifecycle is incomplete")
        return lifecycle

    def evm_transaction(self, tx_id: str) -> dict[str, Any] | None:
        tx_id = self._transaction_hash(tx_id)
        self._require_chain()
        result = self.call("eth_getTransactionByHash", [tx_id])
        if result is not None and not isinstance(result, dict):
            raise StudioNetRPCError("EVM transaction response is malformed")
        return result

    def evm_transaction_receipt(self, tx_id: str) -> dict[str, Any] | None:
        tx_id = self._transaction_hash(tx_id)
        self._require_chain()
        result = self.call("eth_getTransactionReceipt", [tx_id])
        if result is not None and not isinstance(result, dict):
            raise StudioNetRPCError("EVM receipt response is malformed")
        return result

    def _require_chain(self) -> None:
        if not self._chain_verified:
            self.verify_chain()

    def inspect_eoa_payment(
        self,
        *,
        transfer_id: str,
        parent_tx_id: str,
        external_tx_id: str,
        source_address: str,
        destination_address: str,
        amount_wei: int,
    ) -> EoaPaymentInspection:
        """Fetch actual read-only receipts; leave unlinked payments UNKNOWN.

        `external_tx_id` must come from an independently observed chain-layer
        receipt/indexer. The published GenLayer receipt and lifecycle schemas
        do not expose a verifiable parent-to-external-operation identifier.
        """
        chain_id = self.verify_chain()
        parent_tx_id = self._transaction_hash(parent_tx_id)
        external_tx_id = self._transaction_hash(external_tx_id)
        source_address = self._address(source_address)
        destination_address = self._address(destination_address)
        if not transfer_id or amount_wei <= 0:
            raise ValueError("transfer ID and positive amount are required")
        parent = self.gen_transaction_receipt(parent_tx_id)
        lifecycle = self.gen_transaction_lifecycle(parent_tx_id)
        external = self.evm_transaction(external_tx_id)
        external_receipt = self.evm_transaction_receipt(external_tx_id)
        if external is not None and str(external.get("hash", "")).lower() != external_tx_id:
            raise StudioNetRPCError("EVM transaction hash does not match requested ID")
        if (external_receipt is not None
                and str(external_receipt.get("transactionHash", "")).lower() != external_tx_id):
            raise StudioNetRPCError("EVM receipt hash does not match requested ID")

        parent_status = str(parent.get("statusName", "UNKNOWN")).upper()
        execution_result = parent.get("txExecutionResultName")
        if parent_status == "FINALIZED" and execution_result not in (None, "FinishedWithReturn"):
            parent_status = "FAILED"
        elif lifecycle.get("storedStatus", "").lower() not in ("finalized", "finalised"):
            parent_status = str(lifecycle.get("storedStatus", "UNKNOWN")).upper()

        observed_source = external.get("from") if external else None
        observed_destination = external.get("to") if external else None
        observed_amount = self._parse_quantity(external.get("value")) if external else None
        block_number = self._parse_quantity(external_receipt.get("blockNumber")) if external_receipt else None
        balance_before = None
        balance_after = None
        if external_receipt is not None and block_number is not None:
            if block_number > 0:
                balance_before = self._parse_quantity(self.call(
                    "eth_getBalance", [destination_address, hex(block_number - 1)]
                ))
            balance_after = self._parse_quantity(self.call(
                "eth_getBalance", [destination_address, hex(block_number)]
            ))
        if external_receipt is None:
            child_status = "PENDING" if external is not None else "UNKNOWN"
        else:
            receipt_status = self._parse_quantity(external_receipt.get("status"))
            child_status = "FINALIZED" if receipt_status == 1 else "FAILED"

        observation = TransferObservation(
            transfer_id=transfer_id,
            amount_wei=amount_wei,
            parent_tx_id=parent_tx_id,
            parent_status=parent_status,
            child_tx_id=external_tx_id if external else None,
            child_status=child_status if external else None,
            expected_source_address=source_address,
            expected_destination_address=destination_address,
            observed_source_address=observed_source,
            observed_destination_address=observed_destination,
            child_amount_wei=observed_amount,
            parent_child_link_verified=False,
            recipient_kind="EOA",
        )
        result = reconcile_transfer(observation)
        return EoaPaymentInspection(
            chain_id=chain_id,
            transfer_id=transfer_id,
            parent_tx_id=parent_tx_id,
            external_tx_id=external_tx_id,
            expected_source_address=source_address,
            expected_destination_address=destination_address,
            amount_wei=amount_wei,
            parent_status=parent_status,
            parent_execution_result=execution_result if isinstance(execution_result, str) else None,
            external_status=child_status,
            observed_source_address=observed_source,
            observed_destination_address=observed_destination,
            observed_amount_wei=observed_amount,
            external_receipt_block=block_number,
            destination_balance_before_wei=balance_before,
            destination_balance_after_wei=balance_after,
            parent_child_link_verified=False,
            reconciliation_state=result.state.value,
            reconciliation_reason=result.reason,
        )

    @staticmethod
    def _parse_quantity(value: Any) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int) and value >= 0:
            return value
        if isinstance(value, str):
            try:
                quantity = int(value, 16) if value.startswith("0x") else int(value)
            except ValueError:
                return None
            return quantity if quantity >= 0 else None
        return None

    @staticmethod
    def _address(value: str) -> str:
        if (not isinstance(value, str) or len(value) != 42 or not value.startswith("0x")
                or any(character not in "0123456789abcdefABCDEF" for character in value[2:])):
            raise ValueError("address must be a 20-byte hex address")
        return value.lower()
