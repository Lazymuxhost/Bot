export type ITelegramBotToken = string;
export type ITelegramBotId = string;

export type ITelegramUpdateId = number;
export type ITelegramMessageId = number;
export type ITelegramChatId = number | string;
export type ITelegramUserId = ITelegramChatId;

export type ITelegramParseMode = 'Markdown' | 'HTML';
export type ITelegramAction = 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_audio' | 'upload_audio' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note';

export interface ITelegramResponse<T> {
    ok: boolean,
    error?: any,
    result: T;
}

export interface ITelegramUpdate {
    update_id: ITelegramUpdateId;
    message?: ITelegramMessage;
    edited_message?: any;
    channel_post?: any;
    edited_channel_post?: any;
    inline_query?: any;
    chosen_inline_result?: any;
    callback_query?: any;
    shipping_query?: any;
    pre_checkout_query?: any;
}


export interface ITelegramUser {
    id: ITelegramUserId;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

export interface ITelegramPhotoSize {
    file_id: string;
    width: number;
    height: number;
    file_size?: number;
}

export interface ITelegramDocument {
    file_id: string;
    thumb?: any;
    file_name?: string;
    mime_type?: string;
    file_size?: string;
}

export interface ITelegramMessage {
    message_id: ITelegramMessageId;
    from?: ITelegramUser;
    date: number;
    chat: any;
    forward_from?: ITelegramUser;
    forward_from_chat?: any;
    forward_from_message_id?: number;
    forward_signature?: string;
    forward_date?: number;
    reply_to_message?: any;
    edit_date?: number;
    media_group_id?: string;
    author_signature?: string;
    text?: string;
    entities?: any[];
    caption_entities?: any[];
    audio?: any;
    document?: ITelegramDocument;
    game?: any;
    photo?: ITelegramPhotoSize[];
    sticker?: any;
    video?: any;
    voice?: any;
    video_note?: any;
    caption?: string;
    contact?: any;
    location?: any;
    venue?: any;
    new_chat_members?: ITelegramUser[];
    left_chat_member?: ITelegramUser;
    new_chat_title?: string;
    new_chat_photo?: any[];
    delete_chat_photo?: boolean;
    group_chat_created?: boolean;
    supergroup_chat_created?: boolean;
    channel_chat_created?: boolean;
    migrate_to_chat_id?: number;
    migrate_from_chat_id?: number;
    pinned_message?: any;
    invoice?: any;
    successful_payment?: any;
}

export interface ITelegramFile {
    file_id: string;
    file_size?: number;
    file_path?: string;
}

export interface ITelegramUserProfilePhotos {
    total_count: number;
    photos: ITelegramPhotoSize[];
}