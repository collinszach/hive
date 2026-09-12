"""Ranking of settlement candidates — which inflow looks like someone paying you back.

Repayments arrive as ordinary money-in transactions with nothing marking them as a
repayment, so the picker ranks plausible ones instead of making the user hunt. These
cases are drawn from the real ledger, where one person cleared a month of shares with
a single transfer.
"""
from app.api.shares import MATCH_RANK, classify_candidate


def _c(inflow, description="", share_amount=20.0, pending_total=0.0, contact_name="Anthony Tran"):
    return classify_candidate(
        inflow=inflow,
        description=description,
        share_amount=share_amount,
        pending_total=pending_total,
        contact_name=contact_name,
    )


class TestClassifyCandidate:
    def test_exact_share_amount_wins(self):
        assert _c(20.0, share_amount=20.0) == "exact"

    def test_cents_matter(self):
        # 17.50 and 17.51 are different repayments; don't call the wrong one exact.
        assert _c(17.51, share_amount=17.50) != "exact"

    def test_lump_sum_matching_pending_total(self):
        # The real pattern: 8 shares totalling 128.35, cleared by one transfer.
        assert _c(128.35, share_amount=17.50, pending_total=128.35) == "batch"

    def test_exact_beats_batch_when_both_could_apply(self):
        # A single-share charge whose amount equals the pending total: prefer "exact".
        assert _c(50.0, share_amount=50.0, pending_total=50.0) == "exact"

    def test_name_in_description(self):
        assert _c(999.0, description="Anthony Tran", contact_name="Anthony Tran") == "name"

    def test_first_name_only_is_enough(self):
        # Bank descriptors are inconsistent; match on the first name.
        assert _c(999.0, description="ANTHONY T ZELLE", contact_name="Anthony Tran") == "name"

    def test_amount_beats_name(self):
        # A cent-exact amount is stronger evidence than a name appearing anywhere.
        assert _c(20.0, description="Anthony Tran", share_amount=20.0) == "exact"

    def test_unrelated_inflow_is_merely_recent(self):
        assert _c(2626.41, description="DELOITTE CONSULT") == "recent"

    def test_no_contact_name_does_not_crash(self):
        assert _c(999.0, description="whatever", contact_name=None) == "recent"
        assert _c(999.0, description="whatever", contact_name="") == "recent"

    def test_zero_pending_total_never_matches_batch(self):
        # A zero-amount inflow must not be called a batch match for a zero total.
        assert _c(0.0, share_amount=5.0, pending_total=0.0) == "recent"


class TestMatchRank:
    def test_every_match_kind_is_rankable(self):
        for kind in ("exact", "batch", "name", "recent"):
            assert kind in MATCH_RANK

    def test_rank_order_is_strongest_first(self):
        assert (MATCH_RANK["exact"] < MATCH_RANK["batch"]
                < MATCH_RANK["name"] < MATCH_RANK["recent"])
