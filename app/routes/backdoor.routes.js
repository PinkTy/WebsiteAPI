/**
 * Created on 2019-03-17
 * Author Xuyang Cai
 * Version 1.0
 */

const backdoor = require('../controllers/backdoor.controller');

module.exports = function (app) {
    app.route(app.rootUrl + '/reset')
        .post(backdoor.resetDB);
    app.route(app.rootUrl + '/resample')
        .post(backdoor.resample);
    app.route(app.rootUrl + '/executeSql')
        .post(backdoor.executeSql);
    app.route(app.rootUrl + '/users/:id')
        .get(backdoor.read)
        .patch(backdoor.update);
    app.route(app.rootUrl + '/venues')
        .get(backdoor.readVenue);
    app.route(app.rootUrl + '/users')
        .post(backdoor.create);
    app.route(app.rootUrl + '/users/:id/reviews')
        .get(backdoor.readUserReview);
    app.route(app.rootUrl + '/users/:id/photo')
        .get(backdoor.readUserPhoto)
        .put(backdoor.uploadUserPhoto)
        .delete(backdoor.deleteUserPhoto);
    app.route(app.rootUrl + '/categories')
        .get(backdoor.readCategories);
    app.route(app.rootUrl + '/venues/:id')
        .get(backdoor.readOneVenue)
        .patch(backdoor.updateVenue);
    app.route(app.rootUrl + '/venues/:id/reviews')
        .get(backdoor.readVenueReview);
    app.route(app.rootUrl + '/venues/:id/photos')
        .post(backdoor.postVenuePhoto);
    app.route(app.rootUrl + '/venues/:id/photos/:photoFilename')
        .get(backdoor.getVenuePhoto)
        .delete(backdoor.deleteVenuePhoto);
    app.route(app.rootUrl + '/venues/:id/photos/:photoFilename/setPrimary')
        .post(backdoor.deleteVenuePhoto);
    app.route(app.rootUrl + '/users/login')
        .post(backdoor.log);
    app.route(app.rootUrl + '/users/logout')
        .post(backdoor.out);
    app.route(app.rootUrl + '/venues')
        .post(backdoor.postVenue);
    app.route(app.rootUrl + '/venues/:id/reviews')
        .post(backdoor.postVenueReview);
};
