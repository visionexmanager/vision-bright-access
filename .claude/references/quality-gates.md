# Visionex quality gates

Apply only the gates relevant to the change, but never replace a required high-risk check with a weaker one.

1. Inspect the real execution path and establish acceptance criteria.
2. Prove the defect or missing behavior before changing code.
3. Implement the smallest complete change and preserve unrelated work.
4. Add focused regression coverage for behavior changes.
5. Run `npm run typecheck`, focused tests, `npm run lint`, the full test suite, and `npm run build` when application code changes.
6. Check keyboard access, screen-reader semantics, focus, mobile layout, RTL, locale parity, security boundaries, and loading/error states where relevant.
7. Review `git diff --check`, the complete diff, and changed-file scope.
8. Release through a branch and pull request; require CI on the latest commit.
9. Verify the exact merged commit deployed before calling production complete.

Never invent passing tests, provider responses, production data, or deployment status.
