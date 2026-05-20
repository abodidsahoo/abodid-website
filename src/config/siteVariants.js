export const NAVIGATION_LAYOUTS = {
  topBar: {
    id: "top-bar",
    label: "Top menu bar",
    className: "site-navigation-top-bar",
  },
  leftRail: {
    id: "left-rail",
    label: "Left menu rail",
    className: "site-navigation-left-rail",
  },
};

export const POINTER_VARIANTS = {
  nativeDefault: {
    id: "native-default",
    label: "Default browser pointer",
    className: "pointer-native-default",
  },
  customMagneticFollower: {
    id: "custom-magnetic-follower",
    label: "Custom magnetic follower pointer",
    className: "custom-pointer-magnetic-follower",
  },
};

export const ACTIVE_NAVIGATION_LAYOUT = NAVIGATION_LAYOUTS.topBar.id;
export const ACTIVE_POINTER_VARIANT = POINTER_VARIANTS.nativeDefault.id;
