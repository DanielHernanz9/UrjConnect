import User from './User.js'
import { randomBytes } from 'crypto';

const sessions = new Map();

export function login(email, password) {
    const user = User.login(email, password);
    if (typeof user === "number") {
        return user;
    }
    const token = generateRandomToken();
    sessions.set(token, email);
    return token;
}

export function register(email, password, name, bio) {
    const user = User.register(email, password, name, bio);
    if (typeof user === "number") {
        return user;
    }
    const token = generateRandomToken()
    sessions.set(token, email);
    return token;
}

export function authenticate(token) {
    const email = sessions.get(token);
    if (email) {
        return User.getFromFile(email);
    }
    return undefined;
}

function generateRandomToken() {
    return randomBytes(16).toString('hex');
}

export function logout(token) {
    sessions.delete(token);
}