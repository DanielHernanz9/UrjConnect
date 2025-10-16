import User from './User.js'
import { randomBytes } from 'crypto';

const sessions = {};

export function login(email, password) {
    const user = User.login(email, password);
    if (typeof user === "number") {
        return user;
    }
    const token = generateRandomToken();
    sessions[token] = user;
    console.log(sessions)
    return token;
}

export function register(email, password, name, bio) {
    const user = User.register(email, password, name, bio);
    if (typeof user === "number") {
        return user;
    }
    const token = generateRandomToken()
    sessions[token] = user;
    return token;
}

export function authenticate(token) {
    return sessions[token];
}

function generateRandomToken() {
    return randomBytes(16).toString('hex');
}

export function logout(token) {
    delete sessions[token];
}