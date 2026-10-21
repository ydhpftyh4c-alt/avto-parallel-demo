# Backup before unified buyer selection

Source snapshot: `87f8d20` (2026-10-21).
Annotated tag: `backup-before-unified-selection-20261021`.
Remote: https://github.com/ydhpftyh4c-alt/avto-parallel-demo/tree/backup-before-unified-selection-20261021

The tag is pushed to GitHub. It includes the website, admin sources, automation code and deployment instructions as they existed before unified selection work. Pushing this tag did not update main or publish the new interface to Pages.

## Open a separate copy safely

From the project directory:

```powershell
git worktree add ../site-before-unified-selection backup-before-unified-selection-20261021
```

This opens the snapshot in a separate checkout without discarding current work. Do not use `git reset --hard` on a workspace with changes you need.

## Data outside Git

The ignored `.admin-data/` database/uploads, `vehicle-library/` originals and `.local-source/` processing models are not part of this source backup. They remain on this computer. The admin's database backup/export is a separate operation; a Git rollback does not roll back those runtime records.
