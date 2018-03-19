import {ITelegramBotToken, ITelegramMessage} from "./itelegram";

export interface ITeleBotOptions {
    token: ITelegramBotToken;
    polling?: {
        limit?: number;
        interval?: number;
        timeout?: number;
        waitEvents?: boolean;
    };
}

export interface ITeleBotFlags {
    isRunning: boolean;
    canFetch: boolean;
    waitEvents: boolean;
}

export interface IMethodOptionalProperties {
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    reply_to_message_id?: number;
    reply_markup?: any;
}

export interface ITeleBotEvent {
    processors: Array<Function>;
}

export interface ITeleBotEvents {
    text: ITelegramMessage;
    photo: ITelegramMessage;
    document: ITelegramMessage;
    sticker: ITelegramMessage;
}

export type IEventHears = string | string [] | RegExp | RegExp[];
export type IEventProcessor<T extends keyof ITeleBotEvents> = (data: ITeleBotEvents[T]) => any;

