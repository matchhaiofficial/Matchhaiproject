/**
 * Simple structured logger for the application.
 * Formats logs as: [TIME] [LEVEL] [CONTEXT] Message
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
    private static shouldSkip(context: string) {
        return context === 'TouchDebug';
    }

    private static formatMessage(level: LogLevel, context: string, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const dataString = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
        return `[${timestamp}] [${level}] [${context}] ${message}${dataString}`;
    }

    static debug(context: string, message: string, data?: any) {
        if (this.shouldSkip(context)) return;
        console.debug(this.formatMessage('DEBUG', context, message, data));
    }

    static info(context: string, message: string, data?: any) {
        if (this.shouldSkip(context)) return;
        console.info(this.formatMessage('INFO', context, message, data));
    }

    static warn(context: string, message: string, data?: any) {
        if (this.shouldSkip(context)) return;
        console.warn(this.formatMessage('WARN', context, message, data));
    }

    static error(context: string, message: string, error?: any) {
        if (this.shouldSkip(context)) return;
        let errorDetails = '';
        if (error) {
            if (error instanceof Error) {
                errorDetails = `\nMessage: ${error.message}\nStack: ${error.stack}`;
            } else if (typeof error === 'object') {
                errorDetails = `\nData: ${JSON.stringify(error, null, 2)}`;
            } else {
                errorDetails = `\nError: ${String(error)}`;
            }
        }
        console.error(`[${new Date().toISOString()}] [ERROR] [${context}] ${message}${errorDetails}`);
    }
}

export default Logger;
