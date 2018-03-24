import axios, {AxiosPromise} from 'axios';
import {convertToArray} from "./utils";
import {
    ITelegramAction, ITelegramBotId, ITelegramBotToken, ITelegramChatId, ITelegramFile, ITelegramInputFile,
    ITelegramInputMedia, ITelegramMessage, ITelegramMessageOptional, ITelegramMessageId, ITelegramParseMode,
    ITelegramResponse, ITelegramUpdate, ITelegramUser, ITelegramUserId, ITelegramUserProfilePhotos
} from "./interfaces/itelegram";
import {
    IEventProcessor, ITeleBotEvents, ITeleBotEvent, ITeleBotFlags, ITeleBotOptions
} from "./interfaces/itelebot";

const messageTypes = [
    'text',
    'photo',
    'document'
];

export class TeleBotDebugger {
    private id:string;

    constructor(id:string) {
        this.id = id;
    }

    public log(...message:any[]) {
        const timeStamp = Date.now();
        console.log.apply(this, [`[${timeStamp}] <${this.id}>`].concat(message));
    }
}

// TODO: improvements
export class TeleBotEvents {
    private eventList = new Map<string, ITeleBotEvent>();
    private eventTextList = new Map<string | RegExp, ITeleBotEvent>();

    public onText(message:string | RegExp, processor:IEventProcessor<'text'>) {
        this.eventTextList.set(message, {
            processors: [processor]
        });
    }

    public on<T extends keyof ITeleBotEvents>(eventName:T, processor:IEventProcessor<T>) {
        const event = this.eventList.get(eventName);
        if (event) {
            if (!event.processors.includes(processor)) {
                event.processors.push(processor);
            }
        } else {
            this.eventList.set(eventName, {
                processors: [processor]
            });
        }
    }

    public dispatchText<T>(eventList:string | RegExp, data:any) {
        return this._dispatch<T>('text', eventList, data);
    }

    public dispatch<T>(eventList:string[] | string, data:any) {
        return this._dispatch<T>('events', eventList, data);
    }

    public getTextEvents() {
        return this.eventTextList;
    }

    private get(storageId:string) {
        switch (storageId) {
            case 'events': return this.eventList;
            case 'text': return this.eventTextList;
            default: return this.eventList;
        }
    }

    private _dispatch<T>(storageId: string, eventList:any, data:any) {
        const promiseList:Promise<any>[] = [];

        eventList = convertToArray<any>(eventList);
        eventList.forEach((eventName:string) => {
            const event = this.get(storageId).get(eventName);

            if (event) {
                for (let eventProcessor of event.processors) {

                    promiseList.push(new Promise((resolve, reject) => {
                        const eventReturn = eventProcessor.call(this, data);

                        if (eventReturn instanceof Promise) {
                            eventReturn.then(resolve).catch(reject);
                        } else {
                            resolve(eventReturn);
                        }

                    }));

                }

            }

        });

        return Promise.all(promiseList);
    }

}

// TODO: improvements
const updateProcessors = {
    message(this:TeleBot, update:ITelegramMessage):any {
        let processorPromises:Promise<any>[] = [];
        for (let messageType of messageTypes) {
            if (messageType in update) {
                if (messageType === 'text') {
                    const messageText = update[messageType] || '';
                    for (let [textEvent] of this.getTextEvents()) {
                        const match = messageText.match(textEvent);
                        if (match) {
                            processorPromises.push(this.dispatchText(textEvent, update));
                        }
                    }
                }
                processorPromises.push(this.dispatch(messageType, update));
                break;
            }
        }
        return Promise.resolve(Promise.all(processorPromises));
    }
};

class TeleBotError extends Error {

}

export class TeleBot extends TeleBotEvents {

    private botId:ITelegramBotId;
    private botToken:ITelegramBotToken;

    private telegramAPI:string;

    private polling = {
        offset: 0,
        timeout: 0,
        interval: 0,
        limit: 100
    };

    private flags:ITeleBotFlags = {
        isRunning: false,
        canFetch: true,
        waitEvents: false
    };

    public dev = new TeleBotDebugger('telebot');

    private lifeCycle:any;

    constructor(options: ITeleBotOptions | ITelegramBotToken) {
        super();

        if (typeof options === 'string') {
            options = {
                token: options
            };
        }

        const {token, polling} = options;

        this.botToken = token;

        if (!this.botToken || !this.botToken.includes(':')) {
            throw new TeleBotError('Invalid bot token.');
        }

        this.botId = this.botToken.split(':')[0];

        this.telegramAPI = `https://api.telegram.org/bot${ this.botToken }`;

        if (polling) {
            polling.waitEvents === true && this.setFlag('waitEvents');
            if (polling.interval && polling.interval > 0) {
                this.polling.interval = polling.interval;
            }
        }

    }

    public start() {
        const {interval} = this.polling;

        this.setFlag('isRunning');

        if (interval > 0) {

            this.lifeCycle = setInterval(() => {
                if (this.hasFlag('isRunning')) {
                    if (this.hasFlag('canFetch')) {
                        this.unsetFlag('canFetch');
                        this.fetchUpdates(true).then(() => {
                            this.setFlag('canFetch');
                        });
                    }
                } else {
                    clearInterval(this.lifeCycle);
                }

            }, interval);

        } else {
            this.fetchUpdates();
        }

    }

    public stop(message?:string) {
        this.unsetFlag('isRunning');
        return this.safeFetchStop();
    }

    private fetchUpdates(runOnce:boolean = false):any {
        if (this.hasFlag('isRunning')) {

            return this.telegramFetchUpdates().then((response) => {

            }).catch((error) => {
                return Promise.resolve(void 0);
            }).then(() => {
                return runOnce ? Promise.resolve(void 0) : this.fetchUpdates();
            });

        } else {
            return Promise.resolve(void 0);
        }
    }

    private telegramResponseProcessor(updateList:ITelegramUpdate[]) {
        let processorPromises:any[] = [];

        return new Promise((resolve) => {

            if (Array.isArray(updateList) && updateList.length > 0) {
                updateList.forEach((update:ITelegramUpdate) => {

                    const nextUpdateId = ++update.update_id;

                    if (this.polling.offset < nextUpdateId) {
                        this.polling.offset = nextUpdateId;
                    }

                    for (let processorName in updateProcessors) {
                        if (processorName in update) {
                            const data = (<any>update)[processorName];
                            return processorPromises.push((<any>updateProcessors)[processorName].call(this, data, {}));
                        }
                    }

                });
            }

            if (this.hasFlag('waitEvents')) {
                resolve(Promise.all(processorPromises));
            } else {
                resolve(updateList);
            }

        });
    }

    private telegramFetchUpdates(
        offset:number = this.polling.offset,
        limit:number = this.polling.limit,
        timeout:number = this.polling.timeout
    ) {
        return this.telegramRequest<ITelegramUpdate[]>('getUpdates', {
            offset, limit, timeout
        }).then((response) => {
            const telegramResponse = response && response.data;
            if (telegramResponse && telegramResponse.ok === true) {
                return this.telegramResponseProcessor(telegramResponse.result);
            } else {
                return Promise.reject(telegramResponse);
            }
        });
    }

    private safeFetchStop(offset:number = this.polling.offset) {
        return this.telegramRequest<ITelegramUpdate[]>('getUpdates', {
            offset: offset, limit: 1, timeout: 0
        });
    }

    private telegramRequest<T>(endpoint:string, data:any):AxiosPromise<ITelegramResponse<T>> {
        const url = this.telegramAPI + '/' + endpoint;
        return axios.request<ITelegramResponse<T>>({
            url, data,
            method: 'post',
            responseType: 'json',
        });
    }

    private telegramMethod<T>({ methodName, requiredData = {}, optionalData = {} }: { methodName:string, requiredData?:any, optionalData?:any }) {
        const finalPostData = Object.assign({}, requiredData, optionalData);
        this.dev.log(methodName + ' -> ' + JSON.stringify(finalPostData));
        return this.telegramRequest<T>(methodName, finalPostData).then((response) => {
            return response.data.result; // TODO: bullet proof check
        });
    }

    public hasFlag<T extends keyof ITeleBotFlags>(name:T) {
        return this.flags[name];
    }

    public setFlag<T extends keyof ITeleBotFlags>(name:T) {
        this.flags[name] = true;
    }

    public unsetFlag<T extends keyof ITeleBotFlags>(name:T) {
        this.flags[name] = false;

    }

    public getMe():Promise<ITelegramUser> {
        return this.telegramMethod<ITelegramUser>({
            methodName: 'getMe'
        });
    }

    public sendMessage(
        chat_id: ITelegramChatId,
        text: string,
        optionalProperties?: {disable_web_page_preview?: boolean} & ITelegramParseMode & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendMessage',
            requiredData: {chat_id, text},
            optionalData: optionalProperties
        });
    }

    public forwardMessage(
        chat_id: ITelegramChatId,
        from_chat_id: ITelegramChatId,
        message_id: ITelegramMessageId,
        optionalProperties?: {disable_notification?: boolean}
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'forwardMessage',
            requiredData: {chat_id, from_chat_id, message_id},
            optionalData: optionalProperties
        });
    }

    public sendPhoto(
        chat_id: ITelegramChatId,
        photo: ITelegramInputFile,
        optionalProperties?: {caption?: string} & ITelegramParseMode & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendPhoto',
            requiredData: {chat_id, photo},
            optionalData: optionalProperties
        });
    }

    public sendAudio(
        chat_id: ITelegramChatId,
        audio: ITelegramInputFile,
        optionalProperties?: {caption?: string, duration?: number, performer?: string, title?: string} & ITelegramParseMode & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendAudio',
            requiredData: {chat_id, audio},
            optionalData: optionalProperties
        });
    }

    public sendVideo(
        chat_id: ITelegramChatId,
        video: ITelegramInputFile,
        optionalProperties?: {caption?: string, duration?: number, width?: number, height?: number, supports_streaming?: boolean} & ITelegramParseMode & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendVideo',
            requiredData: {chat_id, video},
            optionalData: optionalProperties
        });
    }

    public sendDocument(
        chat_id: ITelegramChatId,
        document: ITelegramInputFile,
        optionalProperties?: {caption?: string} & ITelegramParseMode & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendDocument',
            requiredData: {chat_id, document},
            optionalData: optionalProperties
        });
    }

    public sendVoice(
        chat_id: ITelegramChatId,
        voice: ITelegramInputFile,
        optionalProperties?: {caption?: string, duration?: number} & ITelegramParseMode & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendVoice',
            requiredData: {chat_id, voice},
            optionalData: optionalProperties
        });
    }

    public sendVideoNote(
        chat_id: ITelegramChatId,
        video_note: ITelegramInputFile,
        optionalProperties?: {duration?: number, length?: number} & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendVideoNote',
            requiredData: {chat_id, video_note},
            optionalData: optionalProperties
        });
    }

    public sendMediaGroup(
        chat_id: ITelegramChatId,
        media: ITelegramInputMedia[],
        optionalProperties?: {reply_to_message_id?: number, disable_notification?: boolean}
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendMediaGroup',
            requiredData: {chat_id, media},
            optionalData: optionalProperties
        });
    }

    public sendLocation(
        chat_id: ITelegramChatId,
        latitude: number,
        longitude: number,
        optionalProperties?: {live_period?:number} & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendLocation',
            requiredData: {chat_id, latitude, longitude},
            optionalData: optionalProperties
        });
    }

    public editMessageLiveLocation({chat_id, message_id, inline_message_id, latitude, longitude, reply_markup}:{chat_id?:ITelegramChatId, message_id?:ITelegramMessageId, inline_message_id?:string, latitude:number, longitude: number, reply_markup:any}):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'editMessageLiveLocation',
            requiredData: {latitude, longitude},
            optionalData: {chat_id, message_id, inline_message_id, reply_markup}
        });
    }

    public stopMessageLiveLocation({chat_id, message_id, inline_message_id, reply_markup}:{chat_id?:ITelegramChatId, message_id?:ITelegramMessageId, inline_message_id?:string, reply_markup:any}):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'editMessageLiveLocation',
            requiredData: {},
            optionalData: {chat_id, message_id, inline_message_id, reply_markup}
        });
    }

    public sendVenue(
        chat_id: ITelegramChatId,
        latitude: number,
        longitude: number,
        title: string,
        address: string,
        optionalProperties?: {foursquare_id?:string} & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendVenue',
            requiredData: {chat_id, latitude, longitude, title, address},
            optionalData: optionalProperties
        });
    }

    public sendContact(
        chat_id: ITelegramChatId,
        phone_number: number,
        first_name: string,
        optionalProperties?: {last_name?:string} & ITelegramMessageOptional
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<ITelegramMessage>({
            methodName: 'sendContact',
            requiredData: {chat_id, phone_number, first_name},
            optionalData: optionalProperties
        });
    }

    public sendAction(
        chat_id: ITelegramChatId,
        action: ITelegramAction,
    ):Promise<ITelegramMessage> {
        return this.telegramMethod<any>({
            methodName: 'sendAction',
            requiredData: {chat_id, action}
        });
    }

    public getUserProfilePhotos(
        user_id: ITelegramUserId,
        optionalProperties?: {offset?:number, limit?:number}
    ):Promise<ITelegramUserProfilePhotos> {
        return this.telegramMethod<ITelegramUserProfilePhotos>({
            methodName: 'getUserProfilePhotos',
            requiredData: {user_id},
            optionalData: optionalProperties
        });
    }

    public getFile(
        file_id: string,
    ):Promise<ITelegramFile> {
        return this.telegramMethod<ITelegramFile>({
            methodName: 'getFile',
            requiredData: {file_id}
        });
    }

}
