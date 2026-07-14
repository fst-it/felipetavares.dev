/**
 * Typed UI-string dictionary (V3d addendum: i18n foundation). Covers every chrome string on the
 * site — nav, header CTA, footer, a11y panel, chat widget, command palette, contact form, intent
 * chips, 404, language switcher. Deliberately excludes content (hero copy, dossier, role
 * narratives, skill domains) — that lives in the per-locale `content/site/site.*.json` files and
 * role JSON `*Pt` fields instead, resolved through `ContentRepository`.
 *
 * `.astro` files call `getStrings(locale)` directly; React islands never call it themselves —
 * they receive their slice of `Strings` as a prop from the `.astro` component that mounts them, so
 * every island stays a pure function of its props with no client-side locale detection.
 */
export interface Strings {
  nav: {
    experience: string;
    projects: string;
    writing: string;
    speaking: string;
    contact: string;
    bookACall: string;
    skipToContent: string;
  };
  languageSwitcher: {
    /** Accessible label for the toggle, e.g. "Switch to Portuguese" / "Switch to English". */
    switchTo: string;
  };
  footer: {
    accessibility: string;
    privacy: string;
    copyright: (year: number, name: string) => string;
    newsletter: string;
  };
  a11yPanel: {
    badgeLabelOpen: string;
    badgeLabelClose: string;
    title: string;
    description: string;
    reduceMotionLabel: string;
    reduceMotionDescription: string;
    highContrastLabel: string;
    highContrastDescription: string;
    largerTextLabel: string;
    largerTextDescription: string;
    visualEffectsLabel: string;
    visualEffectsDescription: string;
    visualEffectsAuto: string;
    visualEffectsFull: string;
    visualEffectsSimple: string;
    visualEffectsOff: string;
    accentLabel: string;
    accentDescription: string;
    accentBlue: string;
    accentOrange: string;
    accentGradient: string;
    readStatement: string;
    close: string;
  };
  chat: {
    launcherLabelOpen: string;
    launcherLabelClose: string;
    /** Visible pill text (V5a fix 9) shown next to the monogram on >=sm screens, distinct from
     *  `launcherLabelOpen` (the aria-label) — first-person, short, reads as a chat invitation
     *  rather than a description of what the button does. */
    launcherPillLabel: string;
    title: string;
    disclaimer: string;
    close: string;
    tryAsking: string;
    starters: string[];
    placeholder: string;
    send: string;
    conversationLabel: string;
    errorSuffix: string;
  };
  commandPalette: {
    triggerLabel: string;
    /** Dialog's accessible name (sr-only heading) — distinct from the header trigger button's
     *  visible "Search" label and the `<label>` on the input itself (`searchLabel`). */
    dialogTitle: string;
    searchLabel: string;
    placeholder: string;
    resultsLabel: string;
    noMatches: string;
    groups: {
      pages: string;
      projects: string;
      writing: string;
      speaking: string;
      actions: string;
    };
    actions: {
      openChat: string;
      bookACall: string;
      downloadCv: string;
      toggleTheme: string;
      a11yOptions: string;
      copyEmail: string;
    };
  };
  contactForm: {
    nameLabel: string;
    emailLabel: string;
    topicLabel: string;
    selectTopic: string;
    topics: Record<'Speaking' | 'Advisory' | 'Exchanging ideas' | 'Other', string>;
    messageLabel: string;
    send: string;
    sending: string;
    successTitle: string;
    successMessage: string;
    genericError: string;
    networkError: string;
    fixHighlightedFields: string;
    validation: {
      nameRequired: string;
      nameTooLong: string;
      emailInvalid: string;
      emailRequired: string;
      topicRequired: string;
      messageTooShort: string;
      messageTooLong: string;
      verificationRequired: string;
    };
  };
  intentChips: {
    hiringExecutive: string;
    technicalDives: string;
    bookingSpeaker: string;
  };
  notFound: {
    title: string;
    description: string;
    backHome: string;
  };
  home: {
    domainsEyebrow: string;
    domainsTitle: string;
    domainsSubtitle: (areaCount: string) => string;
    projectsEyebrow: string;
    projectsTitle: string;
    projectsSubtitle: string;
    projectsEmpty: string;
    readDeepDive: string;
    statusActive: string;
    statusArchived: string;
    statusIncubating: string;
    writingEyebrow: string;
    writingTitle: string;
    writingSubtitle: string;
    writingEmpty: string;
    ctaHeading: string;
    ctaSubtitle: string;
    /** Eyebrow / heading / subtitle framing the four credibility-statement tiles above the CTA.
     *  Added as section framing so the numbered cards read as evidence, not floating claims. */
    credibilityEyebrow: string;
    credibilityHeading: string;
    credibilitySubtitle: string;
    /** Badge shown on EN-only content cards rendered inside PT chrome (V3d addendum's deliberate
     *  v1 scope: writing/project deep-dives stay EN-only) — "in English" translated to PT. */
    inEnglishBadge: string;
  };
  journey: {
    eyebrow: string;
    heading: string;
    chaptersHeading: string;
    techStack: string;
    present: string;
    /** Experience view-toggle labels (item 11, 2026-07-06 refinement). */
    viewSummary: string;
    viewDetailed: string;
  };
  dossier: {
    eyebrow: string;
    subtitle: string;
    summaryHeading: string;
    matrixHeading: string;
    matrixDomain: string;
    matrixDepth: string;
    matrixEvidence: string;
    experienceHeading: string;
    educationHeading: string;
    languagesHeading: string;
    preferStory: string;
    readJourney: string;
    machineReadable: string;
    askMyAi: string;
  };
  projectsPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    empty: string;
    /** InlineExpander trigger label for the tech-stack/metrics disclosure on /projects cards. */
    howItsBuilt: string;
  };
  writingPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    empty: string;
    browseByTheme: string;
    browseByThemeSubtitle: string;
  };
  readingPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    empty: string;
    recentlyReviewed: string;
    /** Type filter chips */
    typeBook: string;
    typeArticle: string;
    typePaper: string;
    ideasWorthStealing: string;
    watchOuts: string;
    whoShouldRead: string;
    readMore: string;
  };
  speakingPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    talksHeading: string;
    typeLabels: Record<'talk' | 'panel' | 'paper' | 'podcast' | 'press', string>;
    viewSlides: string;
    upcoming: string;
    empty: string;
    inviteHeading: string;
    inviteBody: string;
    inviteCta: string;
  };
  contactPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    fastest: string;
    bookHeading: string;
    bookBody: string;
    bookCta: string;
    or: string;
    sendMessage: string;
    formSubtitle: string;
    responseTime: string;
    direct: string;
    elsewhere: string;
  };
  accessibilityPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    standardHeading: string;
    standardBody: string;
    controlsHeading: string;
    controlsIntro: string;
    limitationsHeading: string;
    limitationsBody: string;
    reportHeading: string;
    reportBody: string;
    contactCta: string;
  };
  privacyPage: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    noTrackingHeading: string;
    noTrackingBody: string;
    localStorageHeading: string;
    localStorageIntro: string;
    localStorageThemeLabel: string;
    localStorageThemeBody: string;
    localStorageA11yLabel: string;
    /** Rendered before the /accessibility link — see the PT/EN privacy pages for how the link is
     *  spliced in (kept out of this string so the href can be locale-prefixed correctly). */
    localStorageA11yBodyPrefix: string;
    localStorageChatLabel: string;
    localStorageChatBody: string;
    localStorageOutro: string;
    contactFormHeading: string;
    contactFormBody: string;
    analyticsHeading: string;
    analyticsEnabledBody: string;
    analyticsDisabledBody: string;
    questionsHeading: string;
    questionsBody: string;
    contactCta: string;
  };
}
