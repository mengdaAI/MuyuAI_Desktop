// Configuration management for environment-based settings
// Load environment variables first based on NODE_ENV
const path = require('path');
const fs = require('fs');

// Determine which .env file to load
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

// Load the appropriate .env file
require('dotenv').config({ path: envPath });

console.log(`[Config] Loading environment from: ${envFile} (NODE_ENV: ${nodeEnv})`);

const os = require('os');

const apiUrl = process.env.MUYU_API_DOMAIN || 'https://muyu-api.mengdaai.com';
const webUrl = process.env.MUYU_WEB_URL || 'https://muyu-web.mengdaai.com';
const apiTimeout = process.env.MUYU_API_TIMEOUT || 10000;

class Config {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.defaults = {
            apiUrl: apiUrl,
            apiTimeout: apiTimeout,
            
            webUrl: webUrl,
            
            enableJWT: false,
            fallbackToHeaderAuth: false,
            
            cacheTimeout: 5 * 60 * 1000,
            enableCaching: true,
            
            syncInterval: 0,
            healthCheckInterval: 30 * 1000,
            
            defaultWindowWidth: 400,
            defaultWindowHeight: 60,
            
            enableOfflineMode: true,
            enableFileBasedCommunication: false,
            enableSQLiteStorage: true,
            
            logLevel: 'info',
            enableDebugLogging: false
        };
        
        this.config = { ...this.defaults };
        this.loadEnvironmentConfig();
        this.loadUserConfig();
    }
    
    loadEnvironmentConfig() {
        this.config.apiUrl = apiUrl;
        console.log(`[Config] API URL from env: ${this.config.apiUrl}`);
        
        this.config.webUrl = webUrl;
        console.log(`[Config] Web URL from env: ${this.config.webUrl}`);
        
        if (this.env === 'production') {
            this.config.enableDebugLogging = false;
            this.config.logLevel = 'warn';
        } else if (this.env === 'development') {
            this.config.enableDebugLogging = true;
            this.config.logLevel = 'debug';
        }
    }
    
    loadUserConfig() {
        try {
            const userConfigPath = this.getUserConfigPath();
            if (fs.existsSync(userConfigPath)) {
                const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
                this.config = { ...this.config, ...userConfig };
                console.log('[Config] User config loaded from:', userConfigPath);
            }
        } catch (error) {
            console.warn('[Config] Failed to load user config:', error.message);
        }
    }
    
    getUserConfigPath() {
        const configDir = path.join(os.homedir(), '.muyu');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, 'config.json');
    }
    
    get(key) {
        return this.config[key];
    }
    
    set(key, value) {
        this.config[key] = value;
    }
    
    getAll() {
        return { ...this.config };
    }
    
    saveUserConfig() {
        try {
            const userConfigPath = this.getUserConfigPath();
            const userConfig = { ...this.config };
            
            Object.keys(this.defaults).forEach(key => {
                if (userConfig[key] === this.defaults[key]) {
                    delete userConfig[key];
                }
            });
            
            fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2));
            console.log('[Config] User config saved to:', userConfigPath);
        } catch (error) {
            console.error('[Config] Failed to save user config:', error);
        }
    }
    
    reset() {
        this.config = { ...this.defaults };
        this.loadEnvironmentConfig();
    }
    
    isDevelopment() {
        return this.env === 'development';
    }
    
    isProduction() {
        return this.env === 'production';
    }
    
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const requestedLevelIndex = levels.indexOf(level);
        return requestedLevelIndex >= currentLevelIndex;
    }
}

const config = new Config();

module.exports = config;