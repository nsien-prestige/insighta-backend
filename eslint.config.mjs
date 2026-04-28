import js from '@eslint/js'

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-undef': 'error'
        }
    }
]