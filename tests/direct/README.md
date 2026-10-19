# GenLayer Direct Mode contract tests

Run with `python -m pytest tests/direct -q`. These tests execute contract code under GenLayer Direct Mode and cover MandateOS deposit/funding guards and governance-gated allocations, vote snapshots, quorum, timelocks, mandate/risk checks, dispute resolution, cancellation and replay denial.

Direct Mode is local execution, not StudioNet validator consensus. The governance pipeline test uses a deterministic balance and clock fixture and stubs only ProjectVault identity views and the asynchronous child-message queue because Direct Mode loads one IC class per VM. It verifies MandateOS authorization and queue construction; it does not execute ProjectVault or prove a GEN transfer.
