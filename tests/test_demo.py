"""Tests for the demo's decision logic. All data is fictional (sample_metrics.json)."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import demo  # noqa: E402

DATA = json.loads((ROOT / "sample_metrics.json").read_text(encoding="utf-8"))


def run(sentence):
    return demo.check(sentence, None, DATA)


class FlagsWrongNumbers(unittest.TestCase):
    def test_money_far_off_is_flagged(self):
        out = run("Revenue in March was about $2.1M.")
        self.assertIn("DIFFERENT FROM SOURCE", out)
        self.assertIn("$1.84M", out)

    def test_percent_far_off_is_flagged_in_points(self):
        out = run("I thought churn was higher, maybe 6% in March.")
        self.assertIn("DIFFERENT FROM SOURCE", out)
        self.assertIn("1.9 pp above", out)

    def test_count_far_off_is_flagged(self):
        self.assertIn("DIFFERENT FROM SOURCE", run("Signups in February were 600."))


class ConfirmsCloseNumbers(unittest.TestCase):
    def test_within_tolerance_is_confirmed(self):
        out = run("Active customers in June were 12,900.")
        self.assertIn("CONFIRMED", out)

    def test_scaled_number_is_understood(self):
        self.assertIn("CONFIRMED", run("Active customers in March were 12.3 thousand."))

    def test_percent_inside_half_a_point_is_confirmed(self):
        self.assertIn("CONFIRMED", run("Churn in March was 4.3%."))


class AnswersQuestions(unittest.TestCase):
    def test_value_question_with_relative_period(self):
        out = run("How many new signups did we get last month?")
        self.assertIn("ANSWER", out)
        self.assertIn("520", out)

    def test_whats_metric_in_month_is_a_value_not_a_definition(self):
        out = run("What's churn in June?")
        self.assertIn("3.7%", out)

    def test_definition_from_glossary(self):
        self.assertIn("monthly recurring revenue", run("What does MRR mean?").lower())

    def test_definition_of_a_metric(self):
        self.assertIn("paid invoice", run("What is an active customer?"))


class StaysQuietWhenUnsure(unittest.TestCase):
    def assertQuiet(self, sentence):
        self.assertIsNone(run(sentence), sentence)

    def test_no_known_metric(self):
        self.assertQuiet("The offsite was a great success, everyone loved it.")

    def test_no_period(self):
        self.assertQuiet("Revenue was $2M.")

    def test_period_without_data(self):
        self.assertQuiet("Churn in March 2025 was 3%.")

    def test_two_metrics_in_one_sentence(self):
        self.assertQuiet("Revenue and churn in March were both up.")

    def test_metric_but_no_number(self):
        self.assertQuiet("I feel the new pricing page helped churn in March.")

    def test_the_word_may_is_not_a_month(self):
        self.assertQuiet("We may see revenue grow at 9%.")

    def test_a_year_is_not_a_quantity(self):
        self.assertQuiet("Revenue in March 2026 was strong.")


class Parsing(unittest.TestCase):
    def test_numbers(self):
        kinds = demo.numbers("$2.1M, 6% and 12,900 customers in 2026")
        self.assertEqual(sorted(k for k, _ in kinds), ["pct", "plain", "usd"])

    def test_period_relative(self):
        self.assertEqual(demo.find_period("last month", (2026, 6)), "2026-05")
        self.assertEqual(demo.find_period("last month", (2026, 1)), "2025-12")


class Quarters(unittest.TestCase):
    def test_revenue_quarter_is_the_sum_of_months(self):
        self.assertIn("CONFIRMED", run("Revenue in Q1 was $5.2M."))

    def test_churn_quarter_is_the_average(self):
        self.assertIn("4.0%", run("What was churn in Q2?"))

    def test_active_customers_quarter_is_the_last_month(self):
        self.assertIn("CONFIRMED", run("Active customers in Q1 were 12,310."))

    def test_relative_quarters(self):
        self.assertEqual(demo.find_period("last quarter", (2026, 6)), "2026-Q1")
        self.assertEqual(demo.find_period("last quarter", (2026, 2)), "2025-Q4")
        self.assertEqual(demo.find_period("this quarter", (2026, 6)), "2026-Q2")

    def test_quarter_without_data_is_quiet(self):
        self.assertIsNone(run("Revenue in Q3 was $6M."))

    def test_metric_without_aggregation_is_not_checked_by_quarter(self):
        met = dict(DATA["metrics"][0])
        met.pop("aggregation")
        self.assertIsNone(demo.value_for(met, "2026-Q1"))


class CardText(unittest.TestCase):
    def test_small_gaps_show_a_decimal(self):
        # 5.0M vs 5.167M is a 3.2% gap: it must not be printed as "3%" next to a 3% tolerance
        self.assertIn("3.2% below", run("Revenue last quarter was 5 million."))

    def test_large_gaps_are_rounded(self):
        self.assertIn("14% above", run("Revenue in March was about $2.1M."))


if __name__ == "__main__":
    unittest.main()
