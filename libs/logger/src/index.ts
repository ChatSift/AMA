import { createLogger, format, transports } from 'winston';

export default (name: string) => createLogger({
  format: format.combine(
    format.errors({ stack: true }),
    format.label({ label: name.toUpperCase() }),
    format.timestamp({ format: 'YYYY/MM/DD HH:mm:ss' }),
    format.printf(info => {
      const { timestamp, label, level, message, topic, ...rest } = info;
      const extra = Object.keys(rest).length ? `\n${JSON.stringify(rest, null, 2)}` : '';
      return `[${timestamp}][${label}][${level.toUpperCase()}][${topic}]: ${message}${extra}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.colorize({ level: true }),
      level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug'
    })
  ]
});
