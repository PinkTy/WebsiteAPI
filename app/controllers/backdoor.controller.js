/**
 * Created on 2019-03-17
 * Author Xuyang Cai
 * Version 1.0
 */

const Backdoor = require('../models/backdoor.model');
const CryptoJS = require('crypto-js');
const fs = require('mz/fs');

exports.resetDB = async function (req, res) {
    try {
        await Backdoor.resetDB();
        res.statusMessage = 'OK';
        res.status(200)
            .send();
    } catch (err) {
        if (!err.hasBeenLogged) console.error(err);
        res.statusMessage = 'Internal Server Error';
        res.status(500)
            .send();
    }
};

exports.resample = async function (req, res) {
    try {
        await Backdoor.loadData();
        res.statusMessage = 'Created';
        res.status(201)
            .send();
    } catch (err) {
        if (!err.hasBeenLogged) console.error(err);
        res.statusMessage = 'Internal Server Error';
        res.status(500)
            .send();
    }
};

exports.executeSql = async function (req, res) {
    const sqlCommand = String(req.body);
    try {
        const results = await Backdoor.executeSql(sqlCommand);
        res.statusMessage = 'OK';
        res.status(200)
            .json(results);
    } catch (err) {
        if (!err.hasBeenLogged) console.error(err);
        res.statusMessage = 'Internal Server Error';
        res.status(500)
            .send();
    }
};

/**
 * ---------------------- Users part API ----------------------
 */

/**
 *
 * Register as a new user.
 */

exports.create = async function(req, res){
    let user_data = {
        "username": req.body.username,
        "email": req.body.email,
        "givenName": req.body.givenName,
        "familyName": req.body.familyName,
        "password": req.body.password
    };
    const username_result = await Backdoor.executeSql("SELECT username FROM User"); //Select all user names from database
    const email_result = await Backdoor.executeSql("SELECT email FROM User");  // select all emails from database

    let username = user_data['username'];
    let email = user_data['email'];
    let givenName = user_data['givenName'];
    let familyName = user_data['familyName'];
    let password = user_data['password'];
    //username, email and password cannot be empty.
    if(username == undefined || email == undefined || password == undefined) {
        return res.status(400)
            .send(400);
    }

    //family name and given name can be empty.
    if(familyName != undefined){
        familyName = familyName.toString();
    } else {
        familyName = "";
    }

    if(givenName != undefined){
        givenName = givenName.toString();
    } else {
        givenName = "";
    }

    username = username.toString();
    email = email.toString();
    password = password.toString();

    //check username, password and email cannot be empty or only spaces or password is a number value.
    if(username.length == 0 || password.length == 0 || email.length == 0
        ||! /\S/.test(username) ||! /\S/.test(password) || password.match(/^-{0,1}\d+$/)) {
        return res.status(400)
            .send(400);
    } else if(!validateEmail(email)) { // check email in right format.
        return res.status(400)
            .send(400);
    } else if(chek_in_datapacket(username_result, "username",username) == 1) { // check the username is unique
        return res.status(400)
            .send(400);
    } else if(chek_in_datapacket(email_result, "email",email) == 1) { // check the email is unique
        return res.status(400)
            .send(400);
    } else {
        password = encode(password);
        await Backdoor.insert(username, email, givenName, familyName, password);

        let user_id = await Backdoor.find_username(username);
        user_id = user_id[0]["user_id"];
        res.statusMessage = 'Created';
        return res.status(201)
            .json({"userId": user_id
            });
    }
};

/**
 * Login as an existing user.
 * Either username or email may be used,
 * but one of them must be provided (in addition to a password).
 */

exports.log = async function(req, res) {

    let user_data = {
        "username": req.body.username,
        "password": req.body.password
    };

    let user_data_two = {
        "email": req.body.email,
        "password": req.body.password
    };

    const username_result = await Backdoor.executeSql("SELECT username FROM User");
    const email_result = await Backdoor.executeSql("SELECT email FROM User");

    let username = user_data['username'];
    let email = user_data_two['email'];
    let password = user_data['password'];

    if((username == undefined && email == undefined) || password == undefined ) { // check user does not enter both username and email or password.
        return res.status(400)
            .send(400);
    } else {
        if(username == undefined) {
            username = "";
        }
        if(email == undefined){
            email = "";
        }

        if(! /\S/.test(username) && ! /\S/.test(email)){ // check both email and username only whitespace
            return res.status(400)
                .send(400);
        } else if(username.length == 0 && email.length == 0){ // check both email and username are empty
            return res.status(400)
                .send(400);
        } else if(password.length == 0 || ! /\S/.test(password)) { // check password is empty or only whitespace
            return res.status(400)
                .send(400);
        } else if(email.length != 0 && chek_in_datapacket(email_result, "email",email.toString()) == 0) { // check email exist
            return res.status(400)
                .send(400);
        } else if(username.length != 0 && chek_in_datapacket(username_result, "username",username.toString()) == 0) { // check username exist
            return res.status(400)
                .send(400);
        } else {
            //if user choose use username to log in.
            if(username.length != 0){
                let result = await Backdoor.find_username(username.toString());
                if (decode(result[0]["password"].toString()) != password) { // check password is same
                    return res.status(400)
                        .send(400);
                } else {
                    await Backdoor.setToken(result[0]["user_id"]); // set a Token to this user

                    result = await Backdoor.find_username(username.toString());
                    let req_result = {
                        "userId" : result[0]["user_id"],
                        "token": result[0]["auth_token"].toString()
                    };
                    return res.status(200)
                        .json(req_result);
                }
            } else { // if user only use email to log in
                let result = await Backdoor.find_email(email.toString());

                if (decode(result[0]["password"].toString()) != password) { // check password is the right one
                    return res.status(400)
                        .send(400);
                } else {
                    await Backdoor.setToken(result[0]["user_id"]); // set a Token for this user

                    result = await Backdoor.find_email(email.toString());
                    let req_result = {
                        "userId" : result[0]["user_id"],
                        "token": result[0]["auth_token"].toString()
                    };
                    return res.status(200)
                        .json(req_result);
                }
            }
        }
    }
};

/**
 * Logs out the currently authorised user.
 */
exports.out = async function(req, res) {
    let auto = req.header("X-Authorization");
    if(auto == undefined) {

        return res.status(401)
            .send(401);
    }
    const token_result = await Backdoor.executeSql("SELECT auth_token FROM User");

    if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 1) { // check Token is exist
        let user_id = await Backdoor.find_user_byToken(auto.toString());
        await Backdoor.deleteToken(user_id[0]["user_id"]); // set Token to NULL to this user
        return res.status(200)
            .send(200);
    } else {
        return res.status(401)
            .send(401);
    }
};

/**
 * Retrieve infromation about a user.
 * The email field is only included when the currently authenticated user is viewing their own details.
 */
exports.read = async function(req, res) {
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id == parseInt(id);
    const return_req = await Backdoor.getOne(id); //get all the information about this user from database
    let auto = req.header("X-Authorization");
    console.log(auto);
    if(return_req.length == 0) {
        return res.status(404)
            .send(404);
    } else {

        if(auto == undefined || return_req[0]["auth_token"] != auto.toString()) {  //if is not authenticated user
            return res.status(200)
                .json({"username" : return_req[0]["username"],
                    "givenName": return_req[0]["given_name"],
                    "familyName": return_req[0]["family_name"]});
        } else {                                                                   //if is authenticated user
            return res.status(200)
                .json({"username" : return_req[0]["username"],
                    "email": return_req[0]["email"],
                    "givenName": return_req[0]["given_name"],
                    "familyName": return_req[0]["family_name"]});
        }
    }
};

/**
 * Change a user's details.
 * Only accessible for the user themselves.
 */
exports.update = async function(req, res) {
    let auto = req.header("X-Authorization");
    if(auto == undefined) {
        return res.status(401)
            .send(401);
    }

    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);

    const return_req = await Backdoor.getOne(id);//find the information of this user
    if(return_req.length == 0){ // if this user does not exist
        return res.status(404)
            .send(404);
    }

    let auth_token = await Backdoor.find_token(id); // get Token value of this user
    if(auth_token[0]["auth_token"] != auto.toString()){
        return res.status(403)
            .send(403);
    }
    let user_data = {
        "givenName": req.body.givenName,
        "familyName": req.body.familyName,
        "password": req.body.password
    };


    let givenName = user_data["givenName"];
    let familyName = user_data["familyName"];
    let password = user_data["password"];

    if(givenName == undefined && familyName == undefined && password == undefined) {
        return res.status(400)
            .send(400);
    }

    if(givenName != undefined) {
        givenName = givenName.toString();
    } else {
        givenName = return_req[0]["given_name"];
    }

    if(familyName != undefined) {
        familyName = familyName.toString();
    } else {
        familyName = return_req[0]["family_name"]
    }

    if(password != undefined) {
        password = password.toString();
    } else {
        password = decode(return_req[0]["password"])
    }

    if(return_req[0]["given_name"] == givenName && return_req[0]["family_name"] == familyName
        && return_req[0]["password"] == encode(password)) { // if user does not change anything return 400.
        return res.status(400)
            .send(400);
    } else if(familyName.length ==0 || ! /\S/.test(familyName)) { //family name cannot be empty or only spaces
        return res.status(400)
            .send(400);
    } else if(givenName.length == 0 ||! /\S/.test(givenName)){ //given name cannot be empty or only spaces
        return res.status(400)
            .send(400);
    }  else if(password.length == 0|| password.match(/^-{0,1}\d+$/) || ! /\S/.test(password)){ //password cannot be empty or only spaces
        return res.status(400)
            .send(400);
    } else {
        password = encode(password);
        let values = [givenName, familyName, password, id];
        await Backdoor.alter(values);
        res.statusMessage = 'OK';
        return res.status(200)
            .send(200);
    }
};

/**
 * ---------------------- Users.photo part API ----------------------
 */

/**
 * Set a user's profile photo.
 * Will replace the user's current profile photo if one already exists.
 */
exports.uploadUserPhoto = async function(req, res) {
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let user_result = await Backdoor.getOne(id);// get information about this user
    if(user_result.length == 0){ // check this user is exist
        return res.status(404)
            .send(404);
    }

    let auto = req.header("X-Authorization");
    if(auto == undefined) {
        return res.status(401)
            .send(401)
    }else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User");
        if (chek_in_datapacket(token_result, "auth_token", auto.toString()) == 0) { // check Token value is exist
            return res.status(401)
                .send(401);
        }
        let auto_user_id = await Backdoor.find_user_byToken(auto);
        auto_user_id = auto_user_id[0]["user_id"];

        if (auto_user_id != id) { // check user is unauthorized
            return res.status(403)
                .send(403);
        }
    }

    if(!fs.existsSync('./storage/photos')){ //if there is not a store dictionary path, create a new one
        fs.mkdir('./storage/photos', {recursive: true}, (err) => {
            if(err) throw err;
        });
    }

    if(req.body.length == 0) { // if user does not uploading a photo
        return res.status(400)
            .send(400);
    } else {
        req.body = Buffer.from(req.body, 'base64'); //encode photo to base64
        //user only can upload png or jpeg type photo, if not return 400
        if(req.headers['content-type'] == 'image/jpeg'){
            let name = './storage/photos/' + id.toString() + '.jpeg';

            fs.writeFile(name, req.body, 'base64', (err) => {
                if (err) throw err;
            });
            let values = [id.toString() + '.jpeg', id];
            await Backdoor.update_photo_filename(values);
            return res.status(201)
                .send(201);

        } else if(req.headers['content-type'] == 'image/png') {
            let name = './storage/photos/' + id.toString() + '.png';

            fs.writeFile(name, req.body, 'base64', (err) => {
                if (err) throw err;
            });
            let values = [id.toString() + '.png', id];
            await Backdoor.update_photo_filename(values);
            return res.status(200)
                .send(200);
        } else {
            return res.status(400)
                .send(400);
        }
    }
};

/**
 * Retrieve a user's profile photo.
 * The response MIME type will be either image/png or image/jpeg,
 * depending on the file type of the image being retrieved.
 */
exports.readUserPhoto = async function(req, res) {
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let user_result = await Backdoor.getOne(id); // get information from this user.
    if (user_result.length == 0) { // check this user is exist
        return res.status(404)
            .send(404);
    }
    if (user_result[0]["profile_photo_filename"] == null) { // check this user has a photo
        return res.status(404)
            .send(404);
    }

    const path = './storage/photos/';
    var result;
    if(!fs.existsSync(path + user_result[0]["profile_photo_filename"])){ //check this photo is exist in the file
        return res.status(404)
            .send(404);
    } else {
        fs.readFile(path + user_result[0]["profile_photo_filename"], (err, data) => {
            if (err) throw err;
            result = Buffer.from(data, 'base64'); // encode the photo to base64
            callback();
        });
    }

    function callback() {
        if (user_result[0]["profile_photo_filename"].indexOf('.png') != -1) { //check the photo is png type
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': result.length
            });
            res.write(result);
            res.end();
        } else if (user_result[0]["profile_photo_filename"].indexOf('.jpeg') != -1 ||
                user_result[0]["profile_photo_filename"].indexOf('.jpg') != -1 ) { // check the photo is jpeg type
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': result.length
            });
            res.write(result);
            res.end();
        } else {
            return res.status(404)
                .send(404);
        }
    }

};

/**
 * Delete a user's profile photo.
 */
exports.deleteUserPhoto = async function(req, res){
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let user_result = await Backdoor.getOne(id); //get information from this user
    if(user_result.length == 0){ //check this user is exist
        return res.status(404)
            .send(404);
    }

    let auto = req.header("X-Authorization");
    if(auto == undefined) {
        return res.status(401)
            .send(401)
    }else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User"); //get all the Token from the database.
        if (chek_in_datapacket(token_result, "auth_token", auto.toString()) == 0) { // check this token is exist
            return res.status(401)
                .send(401);
        }
        let auto_user_id = await Backdoor.find_user_byToken(auto);
        auto_user_id = auto_user_id[0]["user_id"];

        if (auto_user_id != id) { //check the Token value is same as this user's Token value
            return res.status(403)
                .send(403);
        }
    }

    if (user_result[0]["profile_photo_filename"] == null) { //check this user has a photo
        return res.status(404)
            .send(404);
    } else {
        const path = './storage/photos/';
        if(!fs.existsSync(path + user_result[0]["profile_photo_filename"])){ //check this photo exists in the file
            return res.status(404)
                .send(404);
        } else {
            let values = ['NULL', id];
            await Backdoor.update_photo_filename(values); //set the photo name to null
            await fs.unlinkSync(path + user_result[0]["profile_photo_filename"]); //delete this photo from the file
            return res.status(200)
                .send(200);
        }
    }
};

/**
 * ---------------------- Venues part API ----------------------
 */

/**
 * View venues.
 * The distance field (from the user's location to the venue)
 * is only included in the results when myLatitude and myLongitude parameters are provided.
 */
exports.readVenue = async function(req, res) {
    const return_req = await Backdoor.getVenue(); //get all the venues information from database.
    var length = return_req.length;
    var i = 0;
    let venues_data = [];

    while(i < length) {
        let star_data = await Backdoor.getStarRating(i + 1); //get star rating from database
        let mean_star = mean_cal(star_data, "star_rating"); //get the mean star rating of this venue
        if(mean_star == null) {
            mean_star = null;
        } else {
            mean_star = Math.round(mean_star * 10000) / 10000; //store in 4 decimals
        }

        let cost_data = await Backdoor.getCostRating(i + 1); //get the cost rating of this venue
        let mode_cost = mode_cal(cost_data, "cost_rating"); //get the mode cost rating of this venue
        if(mode_cost == -1) {
            mode_cost = null;
        }

        let primary_photo= await Backdoor.getPrimaryPhoto(i+1);
        if(primary_photo.length == 0) {
            primary_photo = null;
        } else {
            primary_photo = primary_photo[0]["photo_filename"]
        }
        let venue_data =
            {
                "venueId": return_req[i]["venue_id"],
                "venueName": return_req[i]["venue_name"],
                "categoryId": return_req[i]["category_id"],
                "city": return_req[i]["city"],
                "shortDescription": return_req[i]["short_description"],
                "latitude": return_req[i]["latitude"],
                "longitude": return_req[i]["longitude"],
                "meanStarRating": mean_star,
                "modeCostRating": mode_cost,
                "primaryPhoto": primary_photo
            };
        venues_data.push(venue_data);
        i++;
    }


    let startIndex = req.query.startIndex; //Number of items to skip before returning results. Default value : 0
    let count = req.query.count; //Number of items to include in results.
    let city = req.query.city; //Only include Venues that are in this city.
    let q = req.query.q; //Only include Venues that have the search term within their title.
    let categoryId = req.query.categoryId; //Only include Venues of this category (id).
    let minStarRating = req.query.minStarRating; //Only include Venues that have an average (mean) star rating >= minStarRating.
    let maxCostRating = req.query.maxCostRating; //Only include Venues that have an average (mode) cost rating <= maxCostRating.
    let adminId = req.query.adminId; //Only include Venues that have the given user (id) as their admin.
    let sortBy = req.query.sortBy; //Sort the Venues by the given property. If sorting by DISTANCE, myLatitude and myLongitude must be supplied. Default is STAR_RATING.
    let reverseSort = req.query.reverseSort; //Sort the Venues in reverse-order. Default is false.
    let myLatitude = req.query.myLatitude; //The user's latitude, used for calculating the closest venues. Must be accompanied by longitude.
    let myLongitude = req.query.myLongitude; //The user's longitude, used for calculating the closest venues. Must be accompanied by latitude.

    if(myLongitude != undefined && myLatitude != undefined) {

        if(isNaN(myLatitude) || isNaN(myLongitude)){
            return res.status(400)
                .send(400);
        }
        if(parseFloat(myLatitude > 90) || parseFloat(myLatitude) < -90 || //check latitude and longitude in right range
            parseFloat(myLongitude) > 180 || parseFloat(myLongitude) < -180) {
            return res.status(400)
                .send(400);
        }
        var i = 0;
        var length = venues_data.length;
        while(i < length) {

            let distance_result = distance(parseFloat(myLatitude), parseFloat(myLongitude), venues_data[i].latitude, venues_data[i].longitude); //get the distance from different venues
            //distance_result = Math.round(distance_result * Math.pow(10, 13)) / Math.pow(10, 13);
            venues_data[i].distance = distance_result;
            i++;
        }
    }
    if(sortBy == undefined){
        venues_data.sort(function(a, b) { //sort the data by mean star rating
            return (isNaN(a.meanStarRating) - isNaN(b.meanStarRating)) ||
                -(parseFloat(a.meanStarRating) > parseFloat(b.meanStarRating)) ||
                +(parseFloat(a.meanStarRating) < parseFloat(b.meanStarRating));
        });
    } else {
        if(sortBy == 'STAR_RATING') { //sort the data by mean star rating
            venues_data.sort(function(a, b) {
                return (isNaN(a.meanStarRating) - isNaN(b.meanStarRating)) ||
                    -(parseFloat(a.meanStarRating) > parseFloat(b.meanStarRating)) ||
                    +(parseFloat(a.meanStarRating) < parseFloat(b.meanStarRating));
            });
        } else if(sortBy == 'COST_RATING') { //sort the data by cost rating
            venues_data.sort(function(a, b) {
                //console.log(a.modeCostRating === null);
                return ((a.modeCostRating === null)-(b.modeCostRating === null)) ||
                    -(parseFloat(a.modeCostRating) > parseFloat(b.modeCostRating)) ||
                    +(parseFloat(a.modeCostRating) < parseFloat(b.modeCostRating));
            });
            venues_data.reverse();
        } else if(myLatitude != undefined && myLongitude != undefined && sortBy == 'DISTANCE') { //sort the data by distance
            venues_data.sort(function(a, b) {
                return ((a.distance === null)-(b.distance === null)) ||
                    -(parseFloat(a.distance) > parseFloat(b.distance)) ||
                    +(parseFloat(a.distance) < parseFloat(b.distance));
            });
            venues_data.reverse();
        } else { //if user enter invalid sort type return 400
            return res.status(400)
                .send(400);
        }
    }

    if(reverseSort != undefined) {
        if(reverseSort == 'true') { //reverse sort the data
            venues_data.reverse();
        } else if(reverseSort == 'false') {
        } else {
            return res.status(400)
                .send(400);
        }
    }
    if(startIndex == undefined) { //the define value of start index is 0.
        startIndex = 0;
    }

    if(isNaN(startIndex)|| parseInt(startIndex) != parseFloat(startIndex)){
        return res.status(400)
            .send(400);
    }
    startIndex = parseInt(startIndex);
    let result = [];
    if(startIndex < 0){ //if start index smaller than 0
        return res.status(400)
            .send(400);
    }
    if(startIndex >= length) { //if start index greater than data length, return 200
        return res.status(200)
            .send(result);
    } else {
        result = venues_data.slice(startIndex);
    }
    if(count != undefined) {
        if(isNaN(count) || parseFloat(count) != parseInt(count)){
            return res.status(400)
                .send(400);
        }
        count = parseInt(req.query.count);
        if(count < 0){
            return res.status(400)
                .send(400);
        }
        if(count - 1 + startIndex >= length) {
            result = venues_data.slice(startIndex);
        } else {
            result = venues_data.slice(startIndex, startIndex + count);
        }
    }

    if(city != undefined) {
        for(var i = result.length - 1; i >= 0; i--) {
            if(result[i]["city"].toLowerCase() != city.toLowerCase()) {
                result.splice(i, 1);
            }
        }
    }

    if(q != undefined) {
        for(var i = result.length - 1; i >= 0; i--) {
            if(result[i]["venueName"].toLowerCase().search(q.toLowerCase()) == -1) {
                result.splice(i, 1);
            }
        }
    }

    if(categoryId != undefined){
        if(isNaN(categoryId) || parseInt(categoryId) != parseFloat(categoryId)){
            return res.status(400)
                .send(400);
        }
        categoryId = parseInt(categoryId);
        if(categoryId < 0){
            return res.status(400)
                .send(400);
        }
        for(var i = result.length - 1; i >= 0; i--) {
            if(result[i]["categoryId"] != categoryId) {
                result.splice(i, 1);
            }
        }
    }

    if(minStarRating != undefined) {
        if(isNaN(minStarRating) || parseInt(minStarRating) != parseFloat(minStarRating)){
            return res.status(400)
                .send(400);
        }
        minStarRating = parseInt(minStarRating);
        if(minStarRating > 5 || minStarRating < 0) { //if star rating greater than 5 or less than 0, return 400
            return res.status(400)
                .send(400);
        }

        for(var i = result.length - 1; i >= 0; i--) {
            if(result[i]["meanStarRating"] == null){
                result.splice(i, 1);
            } else if(result[i]["meanStarRating"] < minStarRating) {
                result.splice(i, 1);
            }
        }
    }

    if(maxCostRating != undefined){
        if(isNaN(maxCostRating) || parseInt(maxCostRating) != parseFloat(maxCostRating)){
            return res.status(400)
                .send(400);
        }
        maxCostRating = parseInt(maxCostRating);
        if(maxCostRating < 0 || maxCostRating > 5) { //if cost rating greater than 5 or less than 0, return 400
            return res.status(400)
                .send(400);
        }

        for(var i = result.length - 1; i >= 0; i--) {

            if(result[i]["modeCostRating"] == null){
                result.splice(i, 1);
            } else if(result[i]["modeCostRating"] > maxCostRating) {
                result.splice(i, 1);
            }
        }
    }

    if(adminId != undefined){
        if(isNaN(adminId) || parseInt(adminId) != parseFloat(adminId)){
            return res.status(400)
                .send(400);
        }
        adminId = parseInt(adminId);
        if(adminId < 0){
            return res.status(400)
                .send(400);
        }
        for(var i = result.length - 1; i >= 0; i--) {
            let adminId_result = await Backdoor.getVenueById(result[i]["venueId"]);
            adminId_result = adminId_result[0]["admin_id"];
            if(adminId_result != adminId) {
                result.splice(i, 1);
            }
        }
    }
    return res.status(200)
        .json(result);
};

/**
 * Add a new venue.
 */
exports.postVenue = async function(req, res) {
    let auto = req.header("X-Authorization");
    let user_data = {
        "venueName": req.body.venueName,
        "categoryId": req.body.categoryId,
        "city": req.body.city,
        "shortDescription": req.body.shortDescription,
        "longDescription": req.body.longDescription,
        "address": req.body.address,
        "latitude": req.body.latitude,
        "longitude": req.body.longitude
    };
    let venueName = user_data["venueName"];
    let categoryId = user_data["categoryId"];
    let city = user_data["city"];
    let shortDescription = user_data["shortDescription"];
    let longDescription = user_data["longDescription"];
    let address = user_data["address"];
    let latitude = user_data["latitude"];
    let longitude = user_data["longitude"];
    if(auto == undefined){ //if user does not contain Token value in the header return 401
        return res.status(401)
            .send(401);
    } else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User"); //check the Token value is in the database
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){
            return res.status(401)
                .send(401);
        }
    }

    let admin_id = await Backdoor.find_user_byToken(auto);
    admin_id = admin_id[0]["user_id"];
    if(venueName == undefined || categoryId == undefined ||
        city == undefined || shortDescription == undefined || longDescription == undefined ||
        address == undefined || latitude == undefined || longitude == undefined) {
        return res.status(400)
            .send(400);
    }
    if(isNaN(latitude) || isNaN(longitude)){ //check latitude and longitude is a number
        return res.status(400)
            .send(400);
    }
    if(parseFloat(latitude) > 90 || parseFloat(latitude) < -90 || parseFloat(longitude) > 180 || parseFloat(longitude) < -180) { //check latitude and longitude in the valid range
        return res.status(400)
            .send(400);
    }

    if(venueName.length == 0 || ! /\S/.test(venueName) || //venue name, city, address, short description cannot be empty or only spaces
        city.length == 0 || ! /\S/.test(city) ||
        address.length == 0 || ! /\S/.test(address) ||
        shortDescription.length == 0 || ! /\S/.test(shortDescription)) {
        return res.status(400)
            .send(400);
    }
    let category_id_list = await Backdoor.executeSql("SELECT category_id FROM VenueCategory");
    if(chek_in_datapacket(category_id_list, "category_id", parseInt(categoryId)) == 0){ //check category id is valid
        return res.status(400)
            .send(400);
    }
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+ today.getDate(); //get current date
    let values = [admin_id, parseInt(categoryId), venueName, city, shortDescription, longDescription,
        date, address, parseFloat(latitude), parseFloat(longitude)];

    let return_result = await Backdoor.insert_venue(values);
    return_result = return_result[1][0]["LAST_INSERT_ID()"]; //get the venue id

    return res.status(201)
        .json({
            "venueId": return_result
        })
};

/**
 * Retrieve detailed information about a venue.
 */
exports.readOneVenue = async function(req, res){
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let venue_information = await Backdoor.getVenueById(id); //get all the information about this venue
    if(venue_information.length == 0){ //check this venue is exist
        return res.status(404)
            .send(404);
    }

    let admin_information = await Backdoor.getOne(venue_information[0]["admin_id"]); //get admin information
    let admin = {
        "userId": venue_information[0]["admin_id"],
        "username": admin_information[0]["username"]
    };
    let category_information = await Backdoor.getCategoryById(venue_information[0]["category_id"]);// get category information
    let category = {
        "categoryId": category_information[0]["category_id"],
        "categoryName": category_information[0]["category_name"]
    };
    let photo = [];

    let photo_information = await Backdoor.getPhotoById(id); //get photo information
    if(photo_information.length == 0){
        photo = [];
    } else {
        var i = 0;
        var length = photo_information.length;
        while(i < length) {
            let isPrimary = photo_information[i]["is_primary"];
            if(photo_information[i]["is_primary"] == 0){
                if(length == 1 && (photo_information[i]["photo_filename"].indexOf('.jpeg') != -1
                    || photo_information[i]["photo_filename"].indexOf('.jpg') != -1)){
                    isPrimary = new Boolean('true');
                } else {
                    isPrimary = new Boolean(isPrimary);
                }
            } else {
                isPrimary = new Boolean(isPrimary);
            }
            photo.push(
                {
                    "photoFilename": photo_information[i]["photo_filename"],
                    "photoDescription": photo_information[i]["photo_description"],
                    "isPrimary": isPrimary
                }
            );
            i++;
        }
    }
    let return_result = {
        "venueName": venue_information[0]["venue_name"],
        "admin": admin,
        "category": category,
        "city": venue_information[0]["city"],
        "shortDescription": venue_information[0]["short_description"],
        "longDescription": venue_information[0]["long_description"],
        "dateAdded": venue_information[0]["date_added"],
        "address": venue_information[0]["address"],
        "latitude": venue_information[0]["latitude"],
        "longitude": venue_information[0]["longitude"],
        "photos": photo
    };
    return res.status(200)
        .json(return_result);

};

/**
 * Change a venue's details.
 * Only accessible for the administrator of the venue.
 */
exports.updateVenue = async function(req, res) {
    let auto = req.header("X-Authorization");
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);

    if(auto == undefined){ //check if the user contain the Token value in the header
        return res.status(401)
            .send(401);
    } else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User");
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){ //check the Token exist in the database
            return res.status(401)
                .send(401);
        }
    }

    let admin_id = await Backdoor.find_user_byToken(auto);
    admin_id = admin_id[0]["user_id"];
    let venue_result = await Backdoor.getVenueById(id);
    if(venue_result.length == 0){ //check the venue is exist
        return res.status(404)
            .send(404);
    }
    if(venue_result[0]["admin_id"] != admin_id) { //check the admin id is the right one
        return res.status(403)
            .send(403);
    }

    let user_data = {
        "venueName": req.body.venueName,
        "categoryId": req.body.categoryId,
        "city": req.body.city,
        "shortDescription": req.body.shortDescription,
        "longDescription": req.body.longDescription,
        "address": req.body.address,
        "latitude": req.body.latitude,
        "longitude": req.body.longitude
    };
    let venueName = user_data["venueName"];
    let categoryId = user_data["categoryId"];
    let city = user_data["city"];
    let shortDescription = user_data["shortDescription"];
    let longDescription = user_data["longDescription"];
    let address = user_data["address"];
    let latitude = user_data["latitude"];
    let longitude = user_data["longitude"];
    if(venueName == undefined) {
        venueName = venue_result[0]["venue_name"];
    } else {
        if(venueName.length == 0 || ! /\S/.test(venueName)){ //venue name cannot be empty or only space
            return res.status(400)
                .send(400);
        }
    }

    if(categoryId == undefined) {
        categoryId = venue_result[0]["category_id"];
    } else {
        if(isNaN(categoryId) || parseFloat(categoryId) != parseInt(categoryId)){ // category id must be a integer
            return res.status(40)
                .send(40);
        }
        categoryId = parseInt(categoryId);
    }

    if(city == undefined) {
        city = venue_result[0]["city"];
    } else {
        if(city.length == 0 || ! /\S/.test(city)){ //city cannot be empty or only space
            return res.status(400)
                .send(400);
        }
    }

    if(shortDescription == undefined){
        shortDescription = venue_result[0]["short_description"];
    } else {
        if(shortDescription.length == 0 || ! /\S/.test(shortDescription)){ //short description cannot be empty or only space
            return res.status(400)
                .send(400);
        }
    }

    if(longDescription == undefined){
        longDescription = venue_result[0]["long_description"]
    }

    if(address == undefined) {
        address = venue_result[0]["address"]
    } else {
        if(address.length == 0 || ! /\S/.test(address)){ //address cannot be empty or only space
            return res.status(400)
                .send(400);
        }
    }

    if(latitude == undefined){
        latitude = venue_result[0]["latitude"] //latitude must be a number
    } else {
        if(isNaN(latitude)){
            return res.status(400)
                .send(400);
        }
        latitude = parseFloat(latitude);
    }

    if(longitude == undefined){
        longitude = venue_result[0]["longitude"]; //longitude must be a number
    } else {
        if(isNaN(longitude)){
            return res.status(400)
                .send(400);
        }
        longitude = parseFloat(longitude);
    }

    if(venueName == venue_result[0]["venue_name"] && categoryId == venue_result[0]["category_id"] && city == venue_result[0]["city"]&&
        shortDescription == venue_result[0]["short_description"] && longDescription == venue_result[0]["long_description"] && address == venue_result[0]["address"] &&
        latitude == venue_result[0]["latitude"] && longitude== venue_result[0]["longitude"]) {
        return res.status(400)
            .send(400);
    }
    if(latitude > 90 || latitude < -90 || longitude > 180 || longitude < -180) { //check latitude and longitude in the valid range
        return res.status(400)
            .send(400);
    }

    let category_id_list = await Backdoor.executeSql("SELECT category_id FROM VenueCategory");
    if(chek_in_datapacket(category_id_list, "category_id", categoryId) == 0){ //check category id in the database
        return res.status(400)
            .send(400);
    }
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+ today.getDate(); //get current date
    let values = [venueName, categoryId, city, shortDescription, longDescription,
                    date, address, latitude, longitude, id];
    await Backdoor.update_venue(values);
    return res.status(200)
        .send(200);
};

/**
 * Retrieves all data about venue categories.
 */
exports.readCategories = async function(req, res) {
    let req_result = await Backdoor.executeSql("SELECT * FROM VenueCategory");// get all the category information from database
    let return_result = [];
    var i = 0;
    var length = req_result.length;
    while(i < length){
        return_result.push(
            {
                "categoryId": req_result[i]["category_id"],
                "categoryName": req_result[i]["category_name"],
                "categoryDescription": req_result[i]["category_description"]
            }
        );
        i++;
    }
    return res.status(200)
        .json(return_result);
};

/**
 * ---------------------- Venues.photos part API ----------------------
 */

/**
 * Add a photo to a venue.
 * If makePrimary is true, then this photo should become the new primary photo for this venue.
 */
exports.postVenuePhoto = async function(req, res){
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);

    let auto = req.header("X-Authorization");
    if(auto == undefined){ //check the user contain the Token value in the header
        return res.status(401)
            .send(401);
    } else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User");
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){ //check the token value is in the database
            return res.status(401)
                .send(401);
        }
    }

    let admin_id = await Backdoor.find_user_byToken(auto);
    admin_id = admin_id[0]["user_id"];

    let venue_result_list = await Backdoor.getVenueById(id);
    if(venue_result_list.length == 0) { //check the venue is exist
        return res.status(404)
            .send(404);
    } else {
        if(venue_result_list[0]["admin_id"] != admin_id){ //check the admin id is the valid one
            return res.status(403)
                .send(403);
        }
    }
    if(req.file == undefined || req.body['description'] == undefined //upload photo cannot be empty, description cannot be empty or only space,makePrimary must contain in the body
        || req.body['description'].length == 0 || ! /\S/.test(req.body['description']) || req.body['makePrimary'] == undefined) {
        return res.status(400)
            .send(400);
    }

    let venue_photo_result = await Backdoor.getPhotoById(id);
    var i = 0;
    var length = venue_photo_result.length;
    let photo_name = 'Venue_'+ id + '_' + req.file.originalname;
    while(i < length){
        if(venue_photo_result[i]["photo_filename"] ==  photo_name){ //check the photo name is different
            return res.status(400)
                .send(400);
        }
        i++;
    }

    var isPrimary;
    if(req.body['makePrimary'] == 'true'){ //if the makePrimary is true, change all the other photos to non-primary
        isPrimary = 1;
        var i = 0;
        var length = venue_photo_result.length;
        while(i < length){
            if(venue_photo_result[i]["is_primary"] == 1){
                let photo_filename = venue_photo_result[i]["photo_filename"];
                let values = [id, photo_filename];
                await Backdoor.setPhotoPrimary(values);
            }
            i++;
        }
    } else if(req.body['makePrimary'] == 'false') {
        isPrimary = 0;
    } else {
        return res.status(400)
            .send(400);
    }

    if(!fs.existsSync('./storage/photos')){ //if store path does not exist, create a new one
        fs.mkdir('./storage/photos', {recursive: true}, (err) => {
            if(err) throw err;
        });
    }
    var result = Buffer.from(req.file.buffer, 'base64');
    let path = './storage/photos/' + photo_name;
    fs.writeFile(path, result, 'base64', (err) => {
        if (err) throw err;
    });
    let values = [id, photo_name, req.body['description'], isPrimary];
    await Backdoor.InsertVenuePhoto(values);
    return res.status(201)
        .send(201);
};

/**
 * Retrieve a given photo for a venue.
 * The response MIME type will be either image/png or image/jpeg,
 * depending on the file type of the image being retrieved.
 */
exports.getVenuePhoto = async function(req, res){
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let photoFilename = req.params.photoFilename;

    let values = [id, photoFilename];
    const is_primary = await Backdoor.get_primary_id_name(values);// get photo information from database

    if(is_primary.length == 0){ //check the photo is exist
        return res.status(404)
            .send(404);
    }
    if(!fs.existsSync('./storage/photos/' + photoFilename)){ //check file is exist
        return res.status(404)
            .send(404);
    } else {
        var result;
        fs.readFile('./storage/photos/' + photoFilename, (err, data) => {
            if (err) throw err;
            result = Buffer.from(data, 'base64');//encode image from buffer based on base base64
            callback();
        });
        if(photoFilename.indexOf('.png') != -1){ //if the image is png type
            function callback(){
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': result.length
                });
                res.write(result);
                res.end();
            }

        } else if(photoFilename.indexOf('.jpeg') != -1 || photoFilename.indexOf('.jpg') != -1){ //if the image is jpeg type
            function callback(){
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': result.length
                });
                res.write(result);
                res.end();
            }
        } else {
            return res.status(404)
                .send(404);
        }
    }
};

/**
 * Delete a venue's photo.
 * If the venue's primary photo is deleted,
 * then one of its remaining photos should be randomly selected to become the new primary photo.
 * This is irrelevant if this is the venue's only photo.
 */
exports.deleteVenuePhoto = async function(req, res){
    let auto = req.header("X-Authorization");
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let photoFilename = req.params.photoFilename;
    if(auto == undefined){ //check the user contain Token value in the header
        return res.status(401)
            .send(401);
    } else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User"); //check Token value is in the database
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){
            return res.status(401)
                .send(401);
        }
    }

    let admin_id = await Backdoor.find_user_byToken(auto);
    admin_id = admin_id[0]["user_id"];

    let venue_result_list = await Backdoor.getVenueById(id);
    if(venue_result_list.length == 0) { //check the venue is exist
        return res.status(404)
            .send(404);
    } else {
        if(venue_result_list[0]["admin_id"] != admin_id){ //check the admin id is the valid one
            return res.status(403)
                .send(403);
        }
    }
    let path = './storage/photos/' + photoFilename;
    console.log(path);
    if(!fs.existsSync(path)){ //check the file is exist
        return res.status(404)
            .send(404);
    }
    let values = [id, photoFilename];
    var is_primary = await Backdoor.get_primary_id_name(values);
    let venue_photo_result = await Backdoor.getPhotoById(id);
    if(is_primary.length == 0){ //check photo is exist in the database
        return res.status(404)
            .send(404);
    } else if(is_primary[0]["is_primary"] == 0){ //if the photo is not a primary photo, delete it directly
        await Backdoor.delete_photo_id_name(values);
    } else if(is_primary[0]["is_primary"] == 1){ //if the photo is the primary photo, random choose a photo to be primary
        await Backdoor.setPhotoPrimary(values);
        if(venue_photo_result.length == 1){

        } else {
            var i = Math.floor(Math.random()*venue_photo_result.length); //random select a number
            while(1){
                console.log(i);
                if(venue_photo_result[i]["photo_filename"] != photoFilename){
                    let new_values = [venue_photo_result[i]["venue_id"] ,venue_photo_result[i]["photo_filename"]];
                    await Backdoor.setPhotoIsPrimary(new_values);
                    break;
                } else {
                    i = Math.floor(Math.random()*venue_photo_result.length);
                }
            }
        }
        await Backdoor.delete_photo_id_name(values);
    }
    await fs.unlinkSync(path); //delete the photo from the path
    return res.status(200)
        .send(200);
};

/**
 * Set a photo as the primary one for this venue.
 * This sets isPrimary = 0 for all other photos of this venue.
 */
exports.setVenuePhotoPrimary = async function(req, res){
    let auto = req.header("X-Authorization");
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let photoFilename = req.params.photoFilename;

    if(auto == undefined){ //check the user contain Token value in the header
        return res.status(401)
            .send(401);
    } else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User");
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){  //check the Token value store in the database
            return res.status(401)
                .send(401);
        }
    }

    let admin_id = await Backdoor.find_user_byToken(auto);
    admin_id = admin_id[0]["user_id"];

    let venue_result_list = await Backdoor.getVenueById(id);
    if(venue_result_list.length == 0) { //check the venue is exist
        return res.status(404)
            .send(404);
    } else {
        if(venue_result_list[0]["admin_id"] != admin_id){ //check the admin id is the valid one
            return res.status(403)
                .send(403);
        }
    }

    let values = [id, photoFilename];
    var is_primary = await Backdoor.get_primary_id_name(values);
    let venue_photo_result = await Backdoor.getPhotoById(id);
    if(is_primart.length == 0){ //check the photo is exist in the database
        return res.status(404)
            .send(404);
    } else {
        is_primary = is_primary[0]["is_primary"];
        if(is_primary == 1){

        } else { //if this image is not primary before, change all the ohther images to non-primary
            await Backdoor.setPhotoIsPrimary(values);
            var i = 0;
            var length = venue_photo_result.length;
            while(i < length){
                if(venue_photo_result[i]["photo_filename"] != photoFilename &&
                    venue_photo_result[i]["is_primary"] == 1){
                    let change_value = [venue_photo_result[i]['venue_id'],
                        venue_photo_result[i]["photo_filename"]];
                    await Backdoor.setPhotoPrimary(change_value);
                }
                i++;
            }
        }
    }
    return res.status(200)
        .send(200);
};


/**
 * ---------------------- Reviews part API ----------------------
 */

/**
 * Retrieves a venue's reviews.
 * The reviews are returned in reverse chronological order (i.e. most recent first).
 */
exports.readVenueReview = async function(req, res) {
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);

    let venue_information = await Backdoor.getVenueReviewById(id);
    if(venue_information.length == 0){ //check the review is in the database
        return res.status(404)
            .send(404);
    }

    let return_result = [];
    var i = 0;
    var length = venue_information.length;
    while(i < length){
        let user_name = await Backdoor.getOne(venue_information[i]["review_author_id"]);
        user_name = user_name[0]["username"];
        let reviewAuthor =
            {
                "userId": venue_information[i]["review_author_id"],
                "username": user_name
            };

        let myDate = new Date(venue_information[i]["time_posted"].getTime() + 1000*60*60*12);
        return_result.push(
            {
                "reviewAuthor": reviewAuthor,
                "reviewBody": venue_information[i]["review_body"],
                "starRating": venue_information[i]["star_rating"],
                "costRating": venue_information[i]["cost_rating"],
                "timePosted": myDate
            }
        );
        i++;
    }
    return_result.sort(function(a, b) { //sort the result by time posted
        return parseFloat(a.timePosted) - parseFloat(b.timePosted) ;
     });
    return res.status(200)
        .json(return_result);
};

/**
 * Post a review for a venue.
 * A user cannot review a venue they're admin of, nor a venue they have previously reviewed.
 */
exports.postVenueReview = async function(req, res) {
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let auto = req.header("X-Authorization");
    let user_data = {
        "reviewBody": req.body.reviewBody,
        "starRating": req.body.starRating,
        "costRating": req.body.costRating
    };
    let reviewBody = user_data["reviewBody"];
    let starRating = user_data["starRating"];
    let costRating = user_data["costRating"];

    if(auto == undefined) { //check Token value contain in the header
        return res.status(401)
            .send(401)
    }else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User"); //check the token value is in the database
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){
            return res.status(401)
                .send(401);
        }
    }

    let review_author_id = await Backdoor.find_user_byToken(auto);
    review_author_id = review_author_id[0]["user_id"];

    if(reviewBody == undefined || starRating == undefined || costRating == undefined ) { //review body, star rating and cost rating cannot be empty.
        return res.status(400)
            .send(400)
    } else {
        if(parseInt(starRating) != parseFloat(starRating) || parseInt(costRating) != parseFloat(costRating)) {
            return res.status(400)
                .send(400)
        } else {
            starRating = parseInt(starRating);
            costRating = parseInt(costRating);
            if( starRating < 0 || costRating < 0 || starRating > 5 || costRating > 5) {
                return res.status(400)
                    .send(400)
            }
        }
    }

    let venue_id_list = await Backdoor.executeSql("SELECT venue_id FROM Venue");

    if(chek_in_datapacket(venue_id_list, "venue_id", parseInt(id)) == 0){
        return res.status(404)
            .send(404);
    }

    let check_admin = await Backdoor.getVenueById(id);
    if(check_admin[0]["admin_id"] == review_author_id) {
        return res.status(403)
            .send(403);
    }

    let check_review_before = await Backdoor.getVenueReviewById(id);
    if(check_review_before.length != 0) {
        var i = 0;
        var length = check_review_before.length;

        while(i < length) {
            if(check_review_before[i]["review_author_id"] == review_author_id) {
                return res.status(403)
                    .send(403);
            }
            i++;
        }
    }

    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+ today.getDate(); //get current date
    let values = [id, review_author_id, reviewBody, starRating, costRating, date];

    await Backdoor.insert_reviews(values);
    return res.status(201)
        .send(201);
};

/**
 * Retrieves all the reviews authored by a given user.
 * Each review is returned with a brief overview of the venue it is for.
 */
exports.readUserReview = async function(req, res) {
    let auto = req.header("X-Authorization");
    if(auto == undefined){ //check Token value is contain in the header
        return res.status(401)
            .send(401);
    } else {
        const token_result = await Backdoor.executeSql("SELECT auth_token FROM User");//check Token is store in the database
        if(chek_in_datapacket(token_result, "auth_token",auto.toString()) == 0){
            return res.status(401)
                .send(401);
        }
    }
    let id = req.params.id;
    if(isNaN(id) || parseInt(id) != parseFloat(id)){
        return res.status(400)
            .send(400);
    }
    id = parseInt(id);
    let review_results = await Backdoor.find_user_review(id);
    if(review_results.length == 0){ //check user review is exist
        return res.status(404)
            .send(404);
    }

    let user_information = await Backdoor.getOne(id);
    let user_name = user_information[0]["username"];
    let reviewAuthor =
        {
            "userId": id,
            "username": user_name
        }
    ;
    let return_result = [];
    var i = 0;
    var length = review_results.length;
    while(i < length){
        let venue_information = await Backdoor.getVenueById(review_results[i]["review_id"]);
        let categoryName = await Backdoor.getCategoryById(review_results[i]["review_id"]);
        categoryName = categoryName[0]["category_name"];
        let primaryPhoto = await Backdoor.getPrimaryPhoto(review_results[i]["review_id"]);
        console.log(primaryPhoto);
        if(primaryPhoto.length == 0) {
            primaryPhoto = null;
        } else {
            primaryPhoto = primaryPhoto[0]["photo_filename"];
        }

        let venue = {
            "venueId": venue_information[0]["venue_id"],
            "venueName": venue_information[0]["venue_name"],
            "categoryName": categoryName,
            "city": venue_information[0]["city"],
            "shortDescription": venue_information[0]["short_description"],
            "primaryPhoto": primaryPhoto
        };
        let myDate = new Date(review_results[i]["time_posted"].getTime() + 1000*60*60*12);
        return_result.push(
            {
                "reviewAuthor": reviewAuthor,
                "reviewBody": review_results[i]["review_body"],
                "starRating": review_results[i]["star_rating"],
                "costRating": review_results[i]["cost_rating"],
                "timePosted": myDate,
                "venue": venue
            }
        );
        i++;
    }
    return res.status(200)
        .json(return_result);
};

/**
 * ---------------------- Additional Function ----------------------
 */

/**
 * Check email in the valid format.
 * reference: https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
 */
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Check the element in the array.
 * It it in in the array, return 1, else return 0.
 */
function chek_in_datapacket(user_data, key_name, check_data) {
    var in_dictionary = 0;
    var length = user_data.length;
    var i = 0;
    while(i < length) {
        if(user_data[i][key_name] === check_data) {
            in_dictionary = 1;
        }
        i++;
    }
    return in_dictionary;
}

/**
 * Get the mean star rating for a venue.
 */
function mean_cal(data, key_name) {
    var length = data.length;

    var i = 0;
    var result = 0;
    while(i < length) {
        result = result + data[i][key_name];
        i++;
    }
    result = result / length;
    return result;

}

/**
 * Get the mode cost rating for a venue.
 */
function mode_cal(data, key_name) {
    let mode = [];
    var length = data.length;
    var i = 0;

    while(i < length) {
        mode.push(data[i][key_name]);
        i++;
    }

    let mapping = {};
    for(var i = 0;i < length; i++){
        if (!mapping[mode[i]]) mapping[mode[i]] = 0;
        mapping[mode[i]] += 1
    }

    var max_value = 0;
    let result = -1;

    for(const [key, value] of Object.entries(mapping)) {
        if(value >= max_value) {
            result = key;
            max_value = value;
        }
    }
    return parseInt(result);
}

/**
 * Get the distance from one location(by latitude and longitude) to other location(by latitude and longitude)
 * reference: https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula;
 *            https://www.htmlgoodies.com/beyond/javascript/calculate-the-distance-between-two-points-in-your-web-apps.html
 */
function distance(myLatitude, myLongitude, venueLatitude, venueLongitude) {
    var theta = Math.PI / 180;
    var q = Math.cos;

    var result = 0.5 - q((venueLatitude - myLatitude) * theta)/2 +
                q(myLatitude * theta) * q(venueLatitude * theta) *
                (1 - q((venueLongitude - myLongitude) * theta))/2;

    return 12742 * Math.asin(Math.sqrt(result));
}

/**
 * Encode the password to hash value.
 */
function encode(password){
    var b64 = CryptoJS.AES.encrypt(password, 'xca21').toString();
    var e64 = CryptoJS.enc.Base64.parse(b64);
    var eHex = e64.toString(CryptoJS.enc.Hex);
    return eHex;
}

/**
 * Decode the hash value to the plain text.
 */
function decode(password) {
    var reb64 = CryptoJS.enc.Hex.parse(password);
    var bytes = reb64.toString(CryptoJS.enc.Base64);
    var decrypt = CryptoJS.AES.decrypt(bytes, 'xca21');
    var plain = decrypt.toString(CryptoJS.enc.Utf8);
    return plain;
}