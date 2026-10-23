/**
 * Clerk <SignIn>/<SignUp> styling for the auth pages. Colors are the --auth-* CSS variables set on .auth-scope in
 * globals.css (light and dark, and the white-label brand color), so the card follows the theme without re-rendering.
 *
 * Element styles are objects, not Tailwind classes: Clerk's own styles are unlayered and would win over Tailwind's
 * layered utilities. Contrast: input and social-button borders reach 3:1 against the card (WCAG 1.4.11), the primary
 * button's white text 6.3:1, links 4.5:1 in both themes.
 */

const focusRing = {
  outline: "2px solid var(--auth-ring)",
  outlineOffset: "2px",
};

// Clerk draws control borders as a box-shadow with selectors that outrank element styles, hence !important here
const control = {
  borderRadius: "0.75rem",
  border: "1px solid var(--auth-input-border) !important",
  backgroundColor: "var(--auth-input-bg)",
  boxShadow: "0 1px 2px rgb(16 24 40 / 0.04) !important",
};

const focusedControl = {
  outline: "none",
  borderColor: "var(--auth-ring) !important",
  boxShadow: "0 0 0 1px var(--auth-ring), 0 0 0 4px var(--auth-ring-soft) !important",
};

export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--auth-primary)",
    colorPrimaryForeground: "#ffffff",
    colorDanger: "var(--auth-danger)",
    colorBackground: "var(--auth-card-bg)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorMuted: "var(--auth-footer-bg)",
    colorNeutral: "var(--foreground)",
    colorInput: "var(--auth-input-bg)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--auth-card-border)",
    colorRing: "var(--auth-ring)",
    colorShadow: "rgb(16 24 40 / 0.08)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.875rem",
    spacing: "1rem",
  },
  options: {
    // The page shows the brand; Clerk's own logo (the Clerk app's) would also leak onto white-label hosts
    logoPlacement: "none" as const,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "auto" as const,
    shimmer: false,
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: {
      width: "100%",
      maxWidth: "100%",
      borderRadius: "1rem",
      border: "1px solid var(--auth-card-border)",
      boxShadow: "var(--auth-card-shadow)",
      overflow: "hidden",
    },
    card: {
      backgroundColor: "var(--auth-card-bg)",
      boxShadow: "none",
      border: "none",
      borderRadius: 0,
      padding: "1.75rem 1.75rem 1.5rem",
      gap: "1.5rem",
      "@media (max-width: 400px)": { padding: "1.5rem 1.125rem 1.25rem" },
    },
    headerTitle: { fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" },
    headerSubtitle: { color: "var(--muted-foreground)" },
    socialButtonsIconButton: {
      ...control,
      minHeight: "2.75rem",
      "&:hover": { backgroundColor: "var(--auth-hover-bg)" },
      "&:focus-visible": focusRing,
    },
    socialButtonsBlockButton: {
      ...control,
      minHeight: "2.75rem",
      color: "var(--foreground)",
      fontWeight: 500,
      "&:hover": { backgroundColor: "var(--auth-hover-bg)" },
      "&:focus-visible": focusRing,
    },
    dividerLine: { backgroundColor: "var(--auth-card-border)" },
    dividerText: { color: "var(--muted-foreground)", fontSize: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.08em" },
    formFieldLabel: { color: "var(--foreground)", fontWeight: 500, fontSize: "0.8125rem" },
    formFieldInput: {
      ...control,
      minHeight: "2.75rem",
      paddingInline: "0.875rem",
      color: "var(--foreground)",
      transition: "border-color 150ms ease, box-shadow 150ms ease",
      "&::placeholder": { color: "var(--auth-placeholder)" },
      "&:hover": { borderColor: "var(--auth-input-border-hover) !important" },
      "&:focus, &:focus-visible": focusedControl,
    },
    formFieldInputShowPasswordButton: { color: "var(--muted-foreground)", "&:focus-visible": focusRing },
    formFieldAction: { color: "var(--auth-link)", fontWeight: 500, "&:focus-visible": focusRing },
    otpCodeFieldInput: {
      ...control,
      "&:focus, &:focus-visible": focusedControl,
    },
    formButtonPrimary: {
      minHeight: "2.75rem",
      borderRadius: "0.75rem",
      backgroundColor: "var(--auth-primary)",
      backgroundImage: "linear-gradient(180deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0))",
      color: "#ffffff",
      fontSize: "0.875rem",
      fontWeight: 600,
      letterSpacing: "0",
      textTransform: "none" as const,
      border: "none",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.18), 0 1px 2px rgb(16 24 40 / 0.2), 0 6px 16px -6px var(--auth-primary-glow)",
      transition: "background-color 150ms ease, box-shadow 150ms ease",
      "&:hover": { backgroundColor: "var(--auth-primary-hover)" },
      "&:focus-visible": focusRing,
    },
    footer: {
      background: "var(--auth-footer-bg)",
      borderTop: "1px solid var(--auth-card-border)",
    },
    footerActionText: { color: "var(--muted-foreground)" },
    footerActionLink: {
      color: "var(--auth-link)",
      fontWeight: 600,
      "&:hover": { color: "var(--auth-link-hover)", textDecoration: "underline" },
      "&:focus-visible": focusRing,
    },
    identityPreview: { ...control },
    identityPreviewEditButton: { color: "var(--auth-link)", "&:focus-visible": focusRing },
    alternativeMethodsBlockButton: {
      ...control,
      minHeight: "2.75rem",
      "&:hover": { backgroundColor: "var(--auth-hover-bg)" },
      "&:focus-visible": focusRing,
    },
    backLink: { color: "var(--auth-link)", "&:focus-visible": focusRing },
  },
};
