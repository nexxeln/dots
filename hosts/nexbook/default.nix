{ pkgs, username, ... }:

{
  imports = [
    ../../modules/darwin/homebrew.nix
    ../../modules/darwin/system.nix
  ];

  # nix settings
  nix = {
    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      warn-dirty = false;
    };
    # garbage collection
    gc = {
      automatic = true;
      interval = { Weekday = 0; Hour = 2; Minute = 0; };
      options = "--delete-older-than 30d";
    };
  };

  # allow unfree packages
  nixpkgs.config.allowUnfree = true;

  # system packages (prefer homebrew for most things on mac)
  environment.systemPackages = with pkgs; [
    vim
    git
    curl
    wget
  ];

  # zsh is default on mac, but we use fish
  programs.fish.enable = true;

  # networking
  networking = {
    hostName = "nexbook";
    computerName = "nexbook";
  };

  # user
  users.users.${username} = {
    name = username;
    home = "/Users/${username}";
    shell = pkgs.fish;
  };



  # required for nix-darwin
  system.stateVersion = 5;
  
  # set primary user for nix-darwin
  system.primaryUser = username;
}
