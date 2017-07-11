import Fiber from 'fibers';
import Future from 'fibers/future';
import JsonRoutes from 'json-routes';
/**
 * SimpleRest middleware for validating a Meteor.user's login token
 *
 * This middleware must be processed after the request.token has been set to a
 * valid login token for a Meteor.user account (from a separate layer of
 * middleware). If authentication is successful, the request.userId will be set
 * to the ID of the authenticated user.
 *
 * @middleware
 */
export JsonRoutes.Middleware.authenticateMeteorUserByToken =
  (req, res, next) => {
    Fiber(() => {
      const userId = getUserIdFromAuthToken(req.authToken);
      if (userId) {
        req.userId = userId;
      }

      next();
    }).run();
  };

/**
 * Retrieves the ID of the Meteor.user that the given auth token belongs to
 *
 * @param token An unhashed auth token
 * @returns {String} The ID of the authenticated Meteor.user, or null if token
 *     is invalid
 */
function getUserIdFromAuthToken(token) {
  if (!token) {
    return null;
  }

  const user = Meteor.users.findOne({
    'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(token)
  }, {fields: {_id: 1}});
  if (user) {
    return user._id;
  }

  return null;
}
