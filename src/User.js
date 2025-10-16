import bcrypt from 'bcrypt';
import fs from 'fs';

const USERS_DIR = "data/users/"

if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true })
}

export default class User {
    constructor(email, password, name, bio) {
        this.email = email
        this.password = password
        this.name = name
        this.bio = bio
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

    setName(name) {
        this.name = name
        this.saveToFile();
    }
    
    setPassword(password) {
        this.password = password;
        this.saveToFile();
    }
        
    setBio(bio) {
        this.bio = bio;
        this.saveToFile();
    } 

    static register(email, password, name, bio) {
        if (fs.existsSync(USERS_DIR + email)) {
            return 11;
        }
        const o = new User(email);
        o.setName(name);
        o.setPassword(bcrypt.hashSync(password,10));
        o.setBio(bio);
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
        fs.writeFileSync(USERS_DIR + this.email, JSON.stringify(this));
    }

    static getFromFile(email) {
        if (!fs.existsSync(USERS_DIR + email)) {
            return 1
        }
        const json = JSON.parse(fs.readFileSync(USERS_DIR + email));
        return new User(json.email, json.password, json.name, json.bio);
    }
}