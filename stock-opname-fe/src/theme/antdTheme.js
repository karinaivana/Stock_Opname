import { tokens } from './tokens'

export const antdTheme = {
  token: {
    colorPrimary: tokens.primary,
    colorError: tokens.error,
    colorText: tokens.text,
    colorTextSecondary: tokens.textSecondary,
    colorBorder: tokens.surfaceBorder,
    colorBgContainer: tokens.surface,
    colorBgLayout: tokens.background,
    borderRadius: tokens.radius,
    fontFamily: tokens.fontBody,
    controlHeight: 48,
    controlOutlineWidth: 0,
  },
  components: {
    Button: {
      primaryShadow: 'none',
      fontWeight: 600,
      borderRadius: tokens.radius,
    },
    Input: {
      activeBorderColor: tokens.text,
      hoverBorderColor: tokens.surfaceBorder,
      activeShadow: 'none',
      borderRadius: tokens.radius,
    },
    Form: {
      labelColor: tokens.text,
      labelFontSize: 12,
      verticalLabelPadding: '0 0 4px',
    },
    Alert: {
      borderRadiusLG: tokens.radius,
      colorErrorBg: tokens.errorContainer,
      colorErrorBorder: tokens.errorBorder,
    },
  },
}
