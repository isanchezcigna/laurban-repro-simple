/**
 * Sistema de logging unificado para La Urban
 * Permite controlar los niveles de log según el entorno
 */

class Logger {
    constructor() {
        this.isDev = this._isDevelopmentEnvironment();
        this._initializeLogger();
    }

    _isDevelopmentEnvironment() {
        const hostname = globalThis?.location?.hostname ?? '';
        return hostname === 'localhost' || 
               hostname.startsWith('192.168.') || 
               hostname.includes('.local') ||
               hostname.endsWith('.test');
    }

    _initializeLogger() {
        // Guardar las funciones originales
        this._originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };

        // En producción, solo mostrar errores y advertencias importantes
        if (!this.isDev) {
            console.log = () => {};
            console.info = () => {};
            console.debug = () => {};
            // Mantener warn y error para mensajes críticos
        }
    }

    /**
     * Log de desarrollo - Solo visible en entorno de desarrollo
     */
    dev(...args) {
        if (this.isDev) {
            this._originalConsole.debug('[DEV]', ...args);
        }
    }

    /**
     * Log informativo - Solo visible en desarrollo
     */
    info(...args) {
        if (this.isDev) {
            this._originalConsole.info('ℹ️', ...args);
        }
    }

    /**
     * Log de éxito - Solo visible en desarrollo
     */
    success(...args) {
        if (this.isDev) {
            this._originalConsole.log('✅', ...args);
        }
    }

    /**
     * Log de advertencia - Visible en todos los entornos
     */
    warn(...args) {
        this._originalConsole.warn('⚠️', ...args);
    }

    /**
     * Log de error - Visible en todos los entornos
     */
    error(...args) {
        this._originalConsole.error('❌', ...args);
    }

    /**
     * Log crítico - Siempre visible y más destacado
     */
    critical(...args) {
        const style = 'background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;';
        this._originalConsole.error('%c⚠️ CRÍTICO', style, ...args);
    }
}

// Exportar una única instancia global
globalThis.logger = new Logger();