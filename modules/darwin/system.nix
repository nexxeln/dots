{ pkgs, ... }:

{
  # macOS system preferences
  system.defaults = {
    # dock
    dock = {
      autohide = true;
      autohide-delay = 0.0;
      autohide-time-modifier = 0.2;
      orientation = "bottom";
      tilesize = 48;
      show-recents = false;
      mru-spaces = false;
      expose-animation-duration = 0.1;
      # disable hot corners
      wvous-tl-corner = 1;
      wvous-tr-corner = 1;
      wvous-bl-corner = 1;
      wvous-br-corner = 1;
    };

    # finder
    finder = {
      AppleShowAllExtensions = true;
      AppleShowAllFiles = true;
      ShowPathbar = true;
      ShowStatusBar = true;
      FXDefaultSearchScope = "SCcf"; # current folder
      FXPreferredViewStyle = "Nlsv"; # list view
      FXEnableExtensionChangeWarning = false;
      _FXShowPosixPathInTitle = true;
    };

    # global
    NSGlobalDomain = {
      # keyboard
      KeyRepeat = 2;
      InitialKeyRepeat = 15;
      ApplePressAndHoldEnabled = false;

      # mouse/trackpad
      "com.apple.mouse.tapBehavior" = 1;
      "com.apple.trackpad.scaling" = 2.0;

      # appearance
      AppleInterfaceStyle = "Dark";
      AppleShowScrollBars = "WhenScrolling";

      # window management
      NSWindowShouldDragOnGesture = true; # drag windows from anywhere with Cmd+Ctrl

      # misc
      NSAutomaticCapitalizationEnabled = false;
      NSAutomaticDashSubstitutionEnabled = false;
      NSAutomaticPeriodSubstitutionEnabled = false;
      NSAutomaticQuoteSubstitutionEnabled = false;
      NSAutomaticSpellingCorrectionEnabled = false;
      NSNavPanelExpandedStateForSaveMode = true;
      NSNavPanelExpandedStateForSaveMode2 = true;
      PMPrintingExpandedStateForPrint = true;
      PMPrintingExpandedStateForPrint2 = true;
    };

    # login window
    loginwindow = {
      GuestEnabled = false;
      DisableConsoleAccess = true;
    };

    # spaces
    spaces.spans-displays = false;

    # trackpad
    trackpad = {
      Clicking = true;
      TrackpadRightClick = true;
      TrackpadThreeFingerDrag = true;
    };

    # screenshots
    screencapture = {
      location = "~/Pictures/Screenshots";
      type = "png";
      disable-shadow = true;
    };

    # menu bar
    menuExtraClock = {
      Show24Hour = false;
      ShowAMPM = true;
      ShowDate = 1;
      ShowDayOfWeek = true;
    };

    # custom user preferences
    CustomUserPreferences = {
      # disable press-and-hold for keys in favor of key repeat
      NSGlobalDomain = {
        ApplePressAndHoldEnabled = false;
      };
    };
  };

  # security - touch id for sudo
  security.pam.services.sudo_local.touchIdAuth = true;

  # fonts (managed via homebrew casks for now)
  # fonts.packages = [ ];
}
