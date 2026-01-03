---
description: use the graphite cli to create, stack and submit pull requests
model: anthropic/claude-sonnet-4-5
---

following is a cheatsheet for using the graphite (`gt`) cli.
$ARGUMENTS are the instructions by the user. figure out what to do using the cheatsheet.

# Command Cheatsheet

Common tasks and their commands. Click any command to see full documentation in the [command reference](https://graphite.com/docs/command-reference).

## [​](https://graphite.com/docs/cheatsheet\#viewing-your-stack)  Viewing your stack

| Task | Command | Short Form |
| --- | --- | --- |
| See full information about all of your branches and their PRs | [`gt log`](https://graphite.com/docs/command-reference#gt-log-%5Bcommand%5D) |  |
| See all of your branches | [`gt log short`](https://graphite.com/docs/command-reference#gt-log-%5Bcommand%5D) | `gt ls` |

## [​](https://graphite.com/docs/cheatsheet\#creating-and-modifying-branches)  Creating and modifying branches

| Task | Command | Short Form |
| --- | --- | --- |
| Create a new branch | [`gt create`](https://graphite.com/docs/command-reference#gt-create-%5Bname%5D) | `gt c` |
| Create a branch, stage all, commit with message | [`gt create --all --message "message"`](https://graphite.com/docs/command-reference#gt-create-%5Bname%5D) | `gt c -am "message"` |
| Amend staged changes to current branch | [`gt modify`](https://graphite.com/docs/command-reference#gt-modify) | `gt m` |
| Stage all changes and amend them to current branch | [`gt modify --all`](https://graphite.com/docs/command-reference#gt-modify) | `gt m -a` |
| Add a new commit to current branch | [`gt modify --commit`](https://graphite.com/docs/command-reference#gt-modify) | `gt m -c` |
| Stage all changes and add a new commit to current branch with message | [`gt modify --commit --all --message "message"`](https://graphite.com/docs/command-reference#gt-modify) | `gt m -cam "message"` |

## [​](https://graphite.com/docs/cheatsheet\#syncing-and-submitting)  Syncing and submitting

| Task | Command | Short Form |
| --- | --- | --- |
| Pull trunk, clean up merged branches, restack | [`gt sync`](https://graphite.com/docs/command-reference#gt-sync) |  |
| Push current branch and all downstack branches to remote and create/update PRs | [`gt submit`](https://graphite.com/docs/command-reference#gt-submit) |  |
| Push all branches in current stack to remote and create/update PRs | [`gt submit --stack`](https://graphite.com/docs/command-reference#gt-submit) | `gt ss` |
| Only push branches and update PRs for branches that already have PRs open | [`gt submit --stack --update-only`](https://graphite.com/docs/command-reference#gt-submit) | `gt ss -u` |

## [​](https://graphite.com/docs/cheatsheet\#navigating-your-stack)  Navigating your stack

| Task | Command | Short Form |
| --- | --- | --- |
| Switch to a specific branch | [`gt checkout`](https://graphite.com/docs/command-reference#gt-checkout-%5Bbranch%5D) | `gt co` |
| Move up one branch | [`gt up`](https://graphite.com/docs/command-reference#gt-up-%5Bsteps%5D) | `gt u` |
| Move down one branch | [`gt down`](https://graphite.com/docs/command-reference#gt-down-%5Bsteps%5D) | `gt d` |
| Move up/down multiple branches | [`gt up 3`](https://graphite.com/docs/command-reference#gt-up-%5Bsteps%5D), [`gt down 2`](https://graphite.com/docs/command-reference#gt-down-%5Bsteps%5D) | `gt u 3`, `gt d 2` |
| Go to the top of the stack | [`gt top`](https://graphite.com/docs/command-reference#gt-top) | `gt t` |
| Go to the bottom of the stack | [`gt bottom`](https://graphite.com/docs/command-reference#gt-bottom) | `gt b` |

## [​](https://graphite.com/docs/cheatsheet\#reorganizing-your-stack)  Reorganizing your stack

| Task | Command | Short Form |
| --- | --- | --- |
| Move branch to a new parent | [`gt move`](https://graphite.com/docs/command-reference#gt-move) |  |
| Fold branch into its parent | [`gt fold`](https://graphite.com/docs/command-reference#gt-fold) |  |
| Delete branch but keep changes in working tree | [`gt pop`](https://graphite.com/docs/command-reference#gt-pop) |  |
| Reorder branches in your stack | [`gt reorder`](https://graphite.com/docs/command-reference#gt-reorder) |  |
| Split branch into multiple branches | [`gt split`](https://graphite.com/docs/command-reference#gt-split) | `gt sp` |
| Squash all commits in branch into one | [`gt squash`](https://graphite.com/docs/command-reference#gt-squash) | `gt sq` |
| Distribute staged changes to downstack branches by amending relevant commits | [`gt absorb`](https://graphite.com/docs/command-reference#gt-absorb) | `gt ab` |

## [​](https://graphite.com/docs/cheatsheet\#recovery)  Recovery

| Task | Command | Short Form |
| --- | --- | --- |
| Undo the most recent Graphite mutation | [`gt undo`](https://graphite.com/docs/command-reference#gt-undo) |  |

## [​](https://graphite.com/docs/cheatsheet\#tracking-branches)  Tracking branches

| Task | Command | Short Form |
| --- | --- | --- |
| Start tracking an existing Git branch with Graphite | [`gt track`](https://graphite.com/docs/command-reference#gt-track-%5Bbranch%5D) | `gt tr` |
| Stop tracking a branch | [`gt untrack`](https://graphite.com/docs/command-reference#gt-untrack-%5Bbranch%5D) | `gt utr` |

## [​](https://graphite.com/docs/cheatsheet\#collaborating)  Collaborating

| Task | Command | Short Form |
| --- | --- | --- |
| Fetch a teammate’s stack locally | [`gt get`](https://graphite.com/docs/command-reference#gt-get-%5Bbranch%5D) |  |
| Freeze a branch to prevent accidental edits | [`gt freeze`](https://graphite.com/docs/command-reference#gt-freeze-%5Bbranch%5D) |  |
| Unfreeze a branch | [`gt unfreeze`](https://graphite.com/docs/command-reference#gt-unfreeze-%5Bbranch%5D) |  |
