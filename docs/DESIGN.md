---
name: FotoSnaps
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4451'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7d7483'
  outline-variant: '#cec3d3'
  surface-tint: '#7b41b3'
  primary: '#2e0052'
  on-primary: '#ffffff'
  primary-container: '#4b0082'
  on-primary-container: '#ba7ef4'
  inverse-primary: '#ddb7ff'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#301600'
  on-tertiary: '#ffffff'
  tertiary-container: '#4f2700'
  on-tertiary-container: '#c98c5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0050'
  on-primary-fixed-variant: '#622599'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#fbb884'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#693c12'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  status-success: '#059669'
  status-warning: '#D97706'
  status-error: '#DC2626'
  status-neutral: '#64748B'
  surface-subtle: '#F8FAFC'
  border-muted: '#E2E8F0'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is built for **FotoSnaps**, a premium attendance platform that merges the precision of photography with professional enterprise management. The brand personality is **authoritative, technical, and sophisticated**, designed to evoke a sense of absolute reliability and high-end craftsmanship.

The visual style is **Modern Minimalism with High-Contrast accents**. It utilizes heavy whitespace to provide breathing room for photographic evidence and dense data, ensuring that "truth" (the data) is always the focal point. By blending clean lines with a restricted, deep color palette, the UI feels like a professional studio tool—utilitarian yet elegant. The design prioritizes clarity of action and the integrity of captured information.

## Colors

The palette is anchored by **Deep Indigo (#4B0082)**, representing the brand identity and professional depth. This is paired with a strictly neutral foundation of absolute blacks and whites to create a high-contrast, editorial feel.

- **Primary**: Used for key interactions, active states, and brand-identifying moments like the camera shutter button.
- **Secondary**: Reserved for high-impact typography and structural elements.
- **Semantic Colors**: These are used strictly for status indicators (Success, Warning, Error). They are desaturated slightly to ensure they don't clash with the premium brand colors but remain functionally distinct.
- **Surface Strategy**: A "White-on-Light-Grey" approach is used to create subtle depth without relying on heavy shadows.

## Typography

This design system uses **Inter** exclusively to maintain a clean, modernist aesthetic that feels technical and legible. 

- **Headlines**: Use tighter letter-spacing and heavier weights to create an "impactful editorial" look.
- **Labels**: All labels (buttons, badges, table headers) use uppercase or semi-bold weights with increased letter-spacing to distinguish them from body content.
- **Data Tables**: Use `body-md` for row content to maximize information density while maintaining readability.
- **Mobile Scaling**: Headlines automatically scale down to prevent excessive wrapping on mobile check-in screens.

## Layout & Spacing

The layout follows a **Hybrid Fluid Grid** philosophy. Content is contained within a 1280px max-width on desktop to maintain a premium "magazine" feel, while elements within that container stretch to fill space.

- **Grid Model**: A standard 12-column grid is used for dashboards. For the mobile check-in experience, a single-column linear flow is enforced to ensure focus.
- **Spacing Rhythm**: Based on an 8px baseline. Use 16px for internal component padding and 24px-32px for section margins.
- **Mobile-First Transitions**: On mobile devices, the side navigation collapses into a bottom bar or a clean hamburger menu to prioritize the camera viewfinder area.

## Elevation & Depth

To maintain a "Minimal" and "Clean" aesthetic, the system avoids heavy shadows. Instead, it uses **Tonal Layering and Sharp Outlines**.

- **Surface Levels**: Level 0 is the light grey background. Level 1 is the pure white card surface.
- **Outlines**: Components use 1px solid borders in `border-muted` (#E2E8F0). This provides structure without the visual "weight" of a shadow.
- **Interactive Elevation**: Subtle, "high-diffusion" shadows (0px 4px 20px rgba(0,0,0,0.05)) are used only for floating elements like Modals or Active Camera overlays.
- **Glassmorphism**: A subtle backdrop blur is applied to the navigation bar and modal overlays to maintain a sense of context and depth.

## Shapes

The system uses **Soft (0.25rem)** roundedness to maintain a professional, slightly architectural feel. 

- **Cards & Inputs**: Use `rounded-sm` (4px) for a sharp, precise appearance.
- **Buttons**: Follow the same 4px radius to stay consistent with the "Technical" brand personality.
- **Status Badges**: These are the only exception, using a full "Pill" shape (9999px) to contrast against the rigid structure of the data grids.
- **Photography Assets**: User profile photos and evidence captures should use a consistent 4px corner radius—never circular—to mimic the look of a printed photograph.

## Components

### Buttons
Buttons are high-contrast. The **Primary Button** is solid `#000000` with white text, providing an aggressive focal point. The **Secondary Button** uses a `border-muted` outline with the Primary Indigo color for the text.

### Inputs
Text fields and photo uploaders use a 1px border. When focused, the border transitions to the Primary Indigo with a subtle 2px outer glow. Labels are always positioned above the input in `label-sm` style.

### Cards
Cards are pure white with no shadow, defined by a 1px `border-muted`. In dashboards, cards use a 24px internal padding.

### Photography Evidence
The "Face Verification" and "Uniform Check" components are framed in a black matte border with a thin white inner stroke, reminiscent of a camera viewfinder. Status overlays (e.g., "Face Matched") appear as semi-transparent bars at the bottom of the image.

### Status Badges
Badges use low-saturation background tints (e.g., light emerald for `VALID`) with high-saturation text of the same hue. They are always rendered in `label-sm` uppercase.

### Navigation
The sidebar is minimalist, using high-contrast icons (line-art style, 2pt stroke) and `label-md` typography. The active state is indicated by a vertical bar in Primary Indigo on the left edge.