{ config, pkgs, lib, ... }:

{
  # global node/bun packages - managed via activation script
  # we don't want nix to manage node itself (fnm handles that)
  # but we ensure global packages are installed

  home.activation.installGlobalBunPackages = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    # only run if bun is available
    if command -v bun &> /dev/null; then
      echo "Installing global bun packages..."
      bun install -g typescript vercel tree-sitter-cli 2>/dev/null || true
    fi
  '';
}
