import bcrypt from 'bcrypt';
import fs from 'fs';

const USERS_DIR = "data/users/"
const DEFAULT_COLOR = "#4299F0";

if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true })
}

export default class User {
    constructor(email, password, name, bio, color, favourites, role, banned = false) {
        this.email = email
        this.password = password
        this.name = name
        this.bio = bio
        this.color = color
        this.favourites = favourites
        this.role = role
        this.banned = !!banned
    }

    isRole(role) {
        return this.role === role
    }

    toJson() {
        return JSON.stringify(this, (key, value) => key === "password" ? undefined : key === "favourites" ? Array.from(value) : value);
    }

    isBanned() {
        return !!this.banned;
    }

    setBanned(flag) {
        this.banned = flag;
        this.saveToFile();
    }

    getEmail() {
        return this.email
    }
    
    getName() {
        return this.name
    }

    getBio() {
        return this.bio
    }

    getColor() {
        return this.color
    }

    getFavourites() {
        return Array.from(this.favourites);
    }

    setFavourites(favourites) {
        this.favourites = new Set(favourites);
        this.saveToFile();
    }

    setName(name) {
        this.name = name
        this.saveToFile();
    }
    
    setPassword(password) {
        this.password = password;
        this.saveToFile();
    }

    changePassword(password) {
        this.setPassword(bcrypt.hashSync(password, 10))
    }
        
    setBio(bio) {
        this.bio = bio;
        this.saveToFile();
    } 

    setColor(color) {
        this.color = color;
        this.saveToFile();
    }

    static register(email, password, name, bio) {
        if (fs.existsSync(USERS_DIR + email)) {
            return 11;
        }
        const hashedPassword = bcrypt.hashSync(password, 10)
        const o = new User(email, hashedPassword, name, bio, DEFAULT_COLOR, new Set(), "user", false);
        o.saveToFile();
        return o;
    }

    static login(email, password) {
        const o = User.getFromFile(email);
        if (typeof o === "number" || o.isPassword(password)) {
            return o;
        } else {
            return 2;
        }
    }

    isPassword(password) {
        return bcrypt.compareSync(password, this.password);
    }

    saveToFile() {
        this.favourites = Array.from(this.favourites);
        fs.writeFileSync(USERS_DIR + this.email, JSON.stringify(this));
    }

    static getFromFile(email) {
        if (!fs.existsSync(USERS_DIR + email)) {
            return 1
        }
        const json = JSON.parse(fs.readFileSync(USERS_DIR + email));
        return new User(json.email, json.password, json.name, json.bio, json.color, new Set(json.favourites), json.role, json.banned ?? false);
    }
}