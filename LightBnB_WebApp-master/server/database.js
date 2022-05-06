const properties = require('./json/properties.json');
const users = require('./json/users.json');
const { Pool } = require ('pg');
const { query } = require('express');

const pool = new Pool({
  user: 'ziggy',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

// pool.query(`SELECT title FROM properties LIMIT 10;`).then(response => {console.log(response)})
/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  const queryString = `SELECT * FROM users 
  WHERE email = $1`;
  return pool
  .query(queryString, [email])
  .then((result => {
   // console.log(result.rows)
    return result.rows[0] || null;
  }))
  .catch((err) => {
    console.log(err.message)
    return null;
  });

  // let user;
  // for (const userId in users) {
  //   user = users[userId];
  //   if (user.email.toLowerCase() === email.toLowerCase()) {
  //     break;
  //   } else {
  //     user = null;
  //   }
  // }
  // return Promise.resolve(user);
}
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  const queryString = `SELECT * FROM users 
  WHERE id = $1`;
  return pool
  .query(queryString, [id])
  .then((result => {
    return result.rows[0] || null;
  }))
  .catch((err) => {
    console.log(err.message)
    return null;
  });

  // return Promise.resolve(users[id]);
}
exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser =  function(user) {
  const queryString = `
  INSERT INTO users (name, email, password)
  VALUES ($1, $2, $3)
  RETURNING *
  `;
  return pool
  .query(queryString, [user.name, user.email, user.password])
  .then((result => {
    return result.rows[0] || null;
  }))

  // const userId = Object.keys(users).length + 1;
  // user.id = userId;
  // users[userId] = user;
  // return Promise.resolve(user);
}
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  const queryString = `
  SELECT reservations.*, properties.*, property_reviews.*, avg(rating) as average_rating
  FROM reservations
  JOIN properties ON reservations.property_id = properties.id
  JOIN property_reviews ON properties.id = property_reviews.property_id
  WHERE reservations.guest_id = $1
  GROUP BY properties.id, reservations.id
  ORDER BY reservations.start_date
  LIMIT $2;
  `
  return pool
  .query(queryString, [guest_id, limit])
  .then((response => {
    console.log(response.rows)
    return response.rows;
  }))
  .catch((err) => {
    console.log(err.message)
    return null;
  });
  // return getAllProperties(null, 2);
}
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {

  //1 Start the query with all information that comes before the WHERE clause
  const queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_reviews.property_id
  `;

  //2 Setup an array to hold any parameters that may be available for the query.
  const queryParams = [];
  let clausePrefix = `WHERE`;

  // 3 Check if a city has been passed in as an option. Add the city to the params array and create a WHERE clause for the city.
  // We can use the length of the array to dynamically get the $n placeholder number. Since this is the first parameter, it will be $1.
  // The % syntax for the LIKE clause must be part of the parameter, not the query.
  
  if (options.city) {
    // queryString += 'WHERE city LIKE "%'+options.city+'%"'
    // queryString += ` city LIKE $`+queryParams.length;
    queryParams.push(`%${options.city}%`);
    // let prefix = query.params.length > 1 ? 'AND' : 'WHERE'
    queryString += `${clausePrefix} city LIKE $${queryParams.length} `;
    clausePrefix = `AND`;
  }

  // 4 Console log everything just to make sure we've done it right.
  console.log(queryString, queryParams);


  if (options.owner_id) {
    queryParams.push(options.owner_id);
    queryString += `${clausePrefix} properties.owner_id = $${queryParams.length} `;
    clausePrefix = `AND`
  };

  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100);
    queryString += `${clausePrefix} properties.minimum_price_per_night = $${queryParams.length} `;  
    clausePrefix = `AND`
  };

  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100);
    queryString += `${clausePrefix} properties.maximum_price_per_night = $${queryParams.length} `;  
    clausePrefix = `AND`
  };

  queryString += `GROUP BY properties.id `;

  if (options.minimum_rating) {
    queryParams.push(options.rating);
    queryString += `HAVING AVG(property_reviews.rating) >= $${queryParams.length} `;  
    clausePrefix = `AND`
  };

  // 5 Add any query that comes after the WHERE clause.
  queryParams.push(limit);
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;
  
  //6 Run the query.
  return pool
  .query (queryString, queryParams)
  .then((result => {
    // console.log(result.rows);
    return result.rows;
  }))
  .catch((err) => {
    console.log(err.message);
  });
  // const limitedProperties = {};
  // for (let i = 1; i <= limit; i++) {
  //   limitedProperties[i] = properties[i];
  // }
  // return Promise.resolve(limitedProperties);
}
exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  // const columns = ['owner_id', 'title', 'description']
  const queryString = `
  INSERT INTO properties (owner_id, title, description, thumbnail_photo_url, cover_photo_url, 
    cost_per_night, street, city, province, post_code, country, parking_spaces, number_of_bathrooms, number_of_bedrooms)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  RETURNING *
  `;
  // let queryString = `
  // INSERT INTO properties (${columns.join(", ")})
  // VALUES (`
  
  // for (let i = 1; i <= columns.length; i++) {
  //   if (i > 1) {
  //     queryString+= ", ";
  //   }
  //   queryString += '$'+i;
  // } 
  // queryString += `)
  // RETURNING *
  // `;
  // const keys = columns.map((column)=> {
  //   return property[column]
  // })

  //const queryParams = [...Object.values(property)]

  const keys = [
    property.owner_id, 
    property.title, 
    property.description, 
    property.thumbnail_photo_url, 
    property.cover_photo_url, 
    property.cost_per_night, 
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ]
  return pool
  .query(queryString, keys)
  .then((result => {
    return result.rows[0] || null;
  }))
  .catch((err) => {
    console.log(err.message);
  });
  // const propertyId = Object.keys(properties).length + 1;
  // property.id = propertyId;
  // properties[propertyId] = property;
  // return Promise.resolve(property);
}
exports.addProperty = addProperty;
