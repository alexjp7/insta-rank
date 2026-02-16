import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const vuetify = createVuetify({
    components,
    directives,
    theme: {
        defaultTheme: 'instaRankDark',
        themes: {
            instaRankDark: {
                dark: true,
                colors: {
                    background: '#0a0a0f',
                    surface: '#14141f',
                    'surface-bright': '#1e1e2e',
                    'surface-variant': '#252538',
                    primary: '#c850c0',
                    'primary-darken-1': '#a040a0',
                    secondary: '#4158d0',
                    'secondary-darken-1': '#3040b0',
                    accent: '#ffcc70',
                    error: '#ff5252',
                    info: '#2196f3',
                    success: '#4caf50',
                    warning: '#fb8c00',
                    'on-background': '#e8e8f0',
                    'on-surface': '#e8e8f0',
                },
            },
        },
    },
    defaults: {
        VBtn: {
            rounded: 'lg',
            variant: 'flat',
        },
        VCard: {
            rounded: 'xl',
            elevation: 0,
        },
        VTextField: {
            variant: 'outlined',
            rounded: 'lg',
        },
    },
});

export default vuetify;
