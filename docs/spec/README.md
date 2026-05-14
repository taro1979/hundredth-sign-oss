# Specifications

This directory contains Hundredth Sign specifications.

## Start Here

- `product-spec.ja.md`: Japanese master product specification for human readers.
  Read this first when you want to understand the current product in one place.
- `product-spec.md`: English master product specification for implementation
  reference. It covers the current OSS self-hosted build, implemented routes,
  API boundaries, data model, operations, and verification rules.
- `oss-single-workspace.md`: single-workspace OSS product boundary.
- `feature-*.md`: feature-level specifications.
- `fix-*.md`: bug/fix specifications with root cause and acceptance criteria.
- `_template.md`: template for future specifications.

## Maintenance Rules

- Treat `product-spec.md` as the current product source of truth. Older
  `feature-*.md` and `fix-*.md` files may describe implementation history or
  acceptance criteria from the original development process.
- Update `product-spec.md` when product-wide behavior, routes, API boundaries,
  compliance behavior, or operations change.
- Update the matching `feature-*.md` or `fix-*.md` when a change is local to one
  feature or bug.
- If `drizzle/schema.ts` changes, also update `docs/domain/data-model.md`.
- Keep implementation evidence concrete: cite routes, routers, tables, commands,
  and acceptance criteria.
