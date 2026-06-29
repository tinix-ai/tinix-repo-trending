declare module 'svg-captcha' {
  export interface CaptchaObj {
    data: string;
    text: string;
  }

  export interface ConfigObject {
    size?: number;
    ignoreChars?: string;
    noise?: number;
    color?: boolean;
    background?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    charPreset?: string;
  }

  export function create(options?: ConfigObject): CaptchaObj;
  export function createMathExpr(options?: ConfigObject): CaptchaObj;
}
