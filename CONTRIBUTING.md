# Contributing

Thank you for looking. This project is early, so the most valuable contributions are **opinions and counterexamples**, not code.

## The easiest ways to help (no code)

1. **Break the demo.** Run `python demo.py --verbose "..."` with sentences from your own meetings. If it flags a correct number, or stays quiet where it should speak, open an Issue with the sentence and what you expected.
2. **Tell us about your meetings.** Which numbers get said wrong, who corrects them, and where is the real number? Post in Discussions.
3. **Review the design.** Read [the vision](docs/VISION.md), [the dictionary spec](docs/METRIC_DICTIONARY.md) and [the architecture](docs/ARCHITECTURE.md). Tell us what you would change.

## If you want to write code

- Look for issues labelled `good first issue` or `help wanted`.
- Say you are taking it in the issue, so two people do not do the same thing.
- Keep the demo **dependency-free** (standard library only). That is a feature.
- Run the tests before you open a pull request:

  ```bash
  python -m unittest discover -s tests -v
  ```

- Add a test for the behavior you add. For this project, **a test for the silent case matters as much as one for the alert.**

## Ground rules

- **No real company data, ever.** Examples and tests use fictional data only. Do not paste real numbers, names or screenshots from your employer.
- **Wrong alerts are bugs; silence is not.** When in doubt, make it quieter.
- **Small commits with a clear message** (`feat:`, `fix:`, `docs:`, `test:`, `ci:`).
- Be kind. See the [code of conduct](CODE_OF_CONDUCT.md).
