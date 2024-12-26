import amJs from '@appliedminds/eslint-config'
import amVue from '@appliedminds/eslint-config/vue.js'

export default [
    ...amJs,
    ...amVue,
    {
        languageOptions: {
            globals: {
                __APP_VERSION__: true
            }
        }
    }
]