
# xit-action

Github Action to sync your [xit](jotaen/xit) file with your repo's project.

## Prerequisites

Create a file in the root of your repository called `todos.xit`.

## Usage/Examples

See [action.yml](action.yml)

Basic: 
```yml
on:
  push: 

jobs:
  sync-todos:
    runs-on: 'ubuntu-latest'
    name: Sync .xit file to Default project
    steps:
      - name: Sync todos
        uses: matyifkbt/xit-action@master
        with:
          owner: ${{ github.repository_owner }}
          repo: ${{ github.event.repository.name }}
          token: ${{ secrets.GITHUB_TOKEN }}
```




### Example

[todos.xit](todos.xit)

```
[@] this is ongoing
[ ] do this
[x] this is done
```

Github Project

```
TODO add screenshot
```