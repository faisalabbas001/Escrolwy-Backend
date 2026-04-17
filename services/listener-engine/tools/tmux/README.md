# ListenerEngine tmux Runner

This setup launches all 5 blockchain listeners plus a Redis monitor in one tmux session, with a dark, high-contrast theme.

## Files

- `tools/tmux/run_listeners.sh` – creates/starts the tmux session with all panes
- `tools/tmux/tmux.conf` – high-contrast theme, mouse, CPU widget (via TPM)

## Prerequisites

- tmux (>= 3.x recommended)
- Node/npm (project deps installed)
- Redis CLI (`redis-cli`) in PATH
- Optional: TPM installed at `~/.tmux/plugins/tpm` for plugins

## Setup

```bash
chmod +x services/listener-engine/tools/tmux/run_listeners.sh
```

Optional: use the tmux config for your user:
```bash
ln -sf "$(pwd)/services/listener-engine/tools/tmux/tmux.conf" ~/.tmux.conf
```

## Run

```bash
services/listener-engine/tools/tmux/run_listeners.sh
tmux attach -t listeners
```

## Pane Layout (auto-tiled)

1. ETH listener   (`CHAIN=eth npm run listener:dev -w listener-engine`)
2. BSC listener   (`CHAIN=bnb npm run listener:dev -w listener-engine`)
3. POLY listener  (`CHAIN=poly npm run listener:dev -w listener-engine`)
4. SOL listener   (`CHAIN=sol npm run listener:dev -w listener-engine`)
5. TRC listener   (`CHAIN=trc npm run listener:dev -w listener-engine`)
6. REDIS monitor  (`redis-cli monitor`)

## Controls (tmux)

- Switch panes: `Ctrl+b` then arrows
- Resize panes: `Ctrl+b` then `Alt + arrows`
- Kill a pane process: `Ctrl+c` inside that pane
- Restart session: `tmux kill-session -t listeners && services/listener-engine/tools/tmux/run_listeners.sh`

## Notes

- Layout auto-adjusts via `tmux select-layout tiled`.
- Each listener logs separately; Redis monitor shows queue activity.
- Theme: dark background, bright active borders, mouse enabled, 20k scrollback, escape-time=0 for snappy Vim/nav.


