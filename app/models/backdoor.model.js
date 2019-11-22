/**
 * Created on 2019-03-17
 * Author Xuyang Cai
 * Version 1.0
 * back.model.js is the model part, select, insert, update and delete information from database
 */

const db = require('../../config/db');
const fs = require('mz/fs');
const crpto = require('crypto');
const CryptoJS = require('crypto-js');

const photoDirectory = './storage/photos/';

exports.resetDB = async function () {
    let promises = [];

    const sql = await fs.readFile('app/resources/create_database.sql', 'utf8');
    promises.push(db.getPool().query(sql));
    if (await fs.exists(photoDirectory)) {
        const files = await fs.readdir(photoDirectory);
        //console.log(files);
        for (const file of files) {
            if (file !== 'default.png') {
                promises.push(fs.unlink(photoDirectory + file));
            }
        }
    }

    return Promise.all(promises);  // async wait for DB recreation and photos to be deleted
};

exports.loadData = async function () {
    await populateDefaultUsers();
    try {
        const sql = await fs.readFile('app/resources/resample_database.sql', 'utf8');
        await db.getPool().query(sql);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.getOne = async function(userid) {
    try {
        return await db.getPool().query('SELECT * FROM User WHERE user_id = ?', userid);

    } catch (err) {
        console.log(err.sql);
        throw err;
    }

};

exports.getVenue = async function() {
    try {
        return await db.getPool().query('SELECT * FROM Venue');

    } catch (err) {
        console.log(err.sql);
        throw err;
    }

};

exports.getPhotoById = async function(id) {
    try{
        return await db.getPool().query('SELECT * FROM VenuePhoto WHERE venue_id = ?', id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.setPhotoPrimary = async function(values){
    try{
        return await db.getPool().query('UPDATE VenuePhoto SET is_primary = 0 WHERE venue_id = ? AND photo_filename = ?', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.setPhotoIsPrimary = async function(values){
    try{
        return await db.getPool().query('UPDATE VenuePhoto SET is_primary = 1 WHERE venue_id = ? AND photo_filename = ?', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.get_primary_id_name = async function(values){
    try{
        return await db.getPool().query('SELECT is_primary FROM VenuePhoto WHERE venue_id = ? AND photo_filename = ?', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.delete_photo_id_name = async function(values){
    try{
        return await db.getPool().query('DELETE FROM VenuePhoto WHERE venue_id = ? AND photo_filename = ?', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.getVenueById = async function(id) {
    try{
        return await db.getPool().query('SELECT * FROM Venue WHERE venue_id = ?', id);
    } catch (err) {
        console.log(err.sql);
        throw err;

    }
};

exports.getVenueReviewById = async function(id) {
    try{
        return await db.getPool().query('SELECT * FROM Review WHERE reviewed_venue_id = ? ORDER BY time_posted DESC', id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.getCategoryById = async function(id) {
    try{
        return await db.getPool().query('SELECT * FROM VenueCategory WHERE category_id = ?', id);
    } catch (err) {
        console.log(err.sql);
        throw err;

    }
};

exports.getStarRating = async function(venue_id) {
    try{
        return await db.getPool().query('SELECT star_rating FROM Review WHERE reviewed_venue_id = ?', venue_id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.getCostRating = async function(venue_id) {
    try{
        return await db.getPool().query('SELECT cost_rating FROM Review WHERE reviewed_venue_id = ?', venue_id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.getPrimaryPhoto = async function(venue_id) {
    try{
        return await db.getPool().query('SELECT photo_filename FROM VenuePhoto WHERE venue_id = ? AND is_primary = 1', venue_id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.InsertVenuePhoto = async function(values){
    try{
        return await db.getPool().query('INSERT INTO VenuePhoto (venue_id, photo_filename, photo_description, is_primary) VALUES (?,?,?,?)', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.insert = async function(username, email, given_name, family_name, userpassword){
    try{
        let values = [username.toString(), email.toString(), given_name.toString(), family_name.toString(), userpassword.toString()];
        //let values = ['adam111']
        await db.getPool().query('INSERT INTO User (username, email, given_name, family_name, password) VALUES (?,?,?,?,?)', values);
    } catch(err){
        console.log(err.sql);
        throw err;
    }

};

exports.insert_reviews = async function(values) {
    try{
        await db.getPool().query('INSERT INTO Review (reviewed_venue_id, review_author_id, review_body, star_rating, cost_rating, time_posted) VALUES (?,?,?,?,?,?)', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.find_username = async function(username) {
    try{
        return await db.getPool().query('SELECT password, user_id, auth_token FROM User WHERE username = ?', username)
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.find_email = async function(email) {
    try{
        return await db.getPool().query('SELECT password, user_id, auth_token FROM User WHERE email = ?', email);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.find_user_byToken = async function(token) {
    try{
        return await db.getPool().query("SELECT user_id FROM User WHERE auth_token = ?", token);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};


exports.find_user_review = async function(user_id) {
    try{
        return await db.getPool().query("SELECT * FROM Review WHERE review_author_id = ? ORDER BY time_posted DESC", user_id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.insert_venue = async function(values) {
    try{
        return await db.getPool().query("INSERT INTO Venue (admin_id, category_id, venue_name, city, " +
            "short_description, long_description, date_added, address, latitude, longitude) " +
            "VALUES (?,?,?,?,?,?,?,?,?,?); SELECT LAST_INSERT_ID();", values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.update_photo_filename = async  function(values){
    try{
        await db.getPool().query("UPDATE User SET profile_photo_filename = ? WHERE user_id = ?", values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.update_venue = async function(values){
    try{
        return await db.getPool().query("UPDATE Venue SET venue_name = ?, category_id = ?, city = ?, " +
            "short_description = ?, long_description = ?, date_added = ?, address = ?, latitude = ?, longitude = ? " +
            "WHERE venue_id = ?", values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.setToken = async function(user_id) {
    try{
        var token = crpto.randomBytes(8).toString('hex');
        //console.log(token);
        let values = [token.toString(), user_id];
        return await db.getPool().query('UPDATE User SET auth_token = ? WHERE user_id = ?', values);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.deleteToken = async function(user_id) {
    try{
        return await db.getPool().query('UPDATE User SET auth_token = null WHERE user_id = ?', user_id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

exports.alter = async function(values) {
    try {
        return await db.getPool().query('UPDATE User SET given_name = ?, family_name = ?, password = ? WHERE user_id = ?', values);
    } catch(err) {
        console.log(err.sql);
        throw err;
    }

};

exports.find_token = async function(user_id) {
    try{
        return await db.getPool().query('SELECT auth_token FROM User WHERE user_id = ?', user_id);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};

/**
 * Populates the User table in the database with the given data. Must be done here instead of within the
 * `resample_database.sql` script because passwords must be hashed according to the particular implementation.
 * @returns {Promise<void>}
 */
async function populateDefaultUsers() {
    const createSQL = 'INSERT INTO User (username, email, given_name, family_name, password) VALUES ?';
    let { properties, usersData } = require('../resources/default_users');

    // Shallow copy all the user arrays within the main data array
    // Ensures that the user arrays with hashed passwords won't persist across multiple calls to this function
    usersData = usersData.map(user => ([ ...user ]));

    const passwordIndex = properties.indexOf('password');
    await Promise.all(usersData.map(user => changePasswordToHash(user, passwordIndex)));

    try {
        await db.getPool().query(createSQL, [usersData]);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
}



async function changePasswordToHash(user, passwordIndex) {
    // TODO you need to implement "passwords.hash()" yourself, then uncomment the line below.

    var passwords = {
        hash: function (password) {
            var b64 = CryptoJS.AES.encrypt(password, 'xca21').toString();
            var e64 = CryptoJS.enc.Base64.parse(b64);
            var eHex = e64.toString(CryptoJS.enc.Hex);
            return eHex;
        }
    };

    user[passwordIndex] = await passwords.hash(user[passwordIndex]);
    // It is recommended you use a reputable cryptology library to do the actual hashing/comparing for you...
}

exports.executeSql = async function (sql) {
    try {
        return await db.getPool().query(sql);
    } catch (err) {
        console.log(err.sql);
        throw err;
    }
};
