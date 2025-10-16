import express from 'express';
import mustacheExpress from 'mustache-express';
import bodyParser from 'body-parser';
import { __dirname } from './dirname.js';
import routerapp from './router.js';
import cookieParser from 'cookie-parser';

const app = express();

app.set('views', __dirname + '/../views');
app.set('view engine', 'html');
app.engine('html', mustacheExpress(), ".html");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static(__dirname + '/../public'));

app.use('/', routerapp);

app.listen(3000, () => console.log('Listening on port 3000!'));