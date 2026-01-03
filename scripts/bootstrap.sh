#!/usr/bin/env bash
set -euo pipefail

# colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[*]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# check if running on macOS
[[ "$OSTYPE" == "darwin"* ]] || error "This script only works on macOS"

# check architecture
ARCH=$(uname -m)
[[ "$ARCH" == "arm64" ]] || warn "This config is optimized for Apple Silicon (arm64), you're on $ARCH"

log "Starting bootstrap..."

# 1. install nix (if not installed)
if ! command -v nix &> /dev/null; then
    log "Installing Nix..."
    curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
    success "Nix installed"
    
    # source nix
    . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
else
    success "Nix already installed"
fi

# 2. clone dotfiles (if not already there)
DOTS_DIR="$HOME/.dots"
if [[ ! -d "$DOTS_DIR" ]]; then
    log "Cloning dotfiles..."
    git clone https://github.com/nexxel/dots.git "$DOTS_DIR"
    success "Dotfiles cloned to $DOTS_DIR"
else
    success "Dotfiles already at $DOTS_DIR"
fi

cd "$DOTS_DIR"

# 3. get hostname
HOSTNAME=$(scutil --get LocalHostName 2>/dev/null || hostname -s)
log "Detected hostname: $HOSTNAME"

# check if host config exists
if [[ ! -d "hosts/$HOSTNAME" ]]; then
    warn "No config found for hostname '$HOSTNAME'"
    log "Available hosts:"
    ls -1 hosts/
    error "Please create a host config or use an existing hostname"
fi

# 4. first-time nix-darwin bootstrap
if ! command -v darwin-rebuild &> /dev/null; then
    log "First-time nix-darwin setup..."
    nix run nix-darwin -- switch --flake ".#$HOSTNAME"
else
    log "Running darwin-rebuild..."
    darwin-rebuild switch --flake ".#$HOSTNAME"
fi

success "System configured!"

# 5. post-install reminders
echo ""
log "Post-install steps:"
echo "  1. Authenticate with GitHub:    gh auth login"
echo "  2. Set up 1Password CLI:        op signin"
echo "  3. Configure Graphite:          graphite auth --token \$(op read op://Dev/Graphite/token)"
echo "  4. Install opencode deps:       cd ~/.config/opencode && bun install"
echo "  5. Restart your terminal"
echo ""
success "Bootstrap complete!"
