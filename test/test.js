import test from 'ava';
import {TeleBot} from '../dist/telebot';

const {TELEBOT_TEST_TOKEN: TOKEN, TELEBOT_TEST_USER: USER} = process.env;

const testMethods = {
    getMe: [],
    sendMessage: [USER, 'hello'],
    sendLocation: [USER, 37.641401, -115.783262],
    sendVenue: [USER, 56.9713962, 23.9890801, 'The Place', 'Test venue description.'],
    sendContact: [USER, 112, 'User', {last_name: 'Tester'}],
    getUserProfilePhotos: [USER],
};

let bot;

test('bot init', t => {
    bot = new TeleBot({
        token: TOKEN
    });
    t.pass();
});

for (let methodName in testMethods) {
    test(`method ${methodName}`, async t => {
        try {
            await bot[methodName].apply(bot, testMethods[methodName]);
            t.pass();
        } catch(error) {
            t.fail(error);
        }
    });
}