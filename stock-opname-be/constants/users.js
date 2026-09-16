// bcrypt rounds
const BCRYPT_ROUNDS = 10;

// unique constraint messages
const UNIQUE_CONSTRAINT_MESSAGES = {
    users_email_key: "Email has already been used",
    users_full_name_key: "Name has already been used",
};

module.exports = {
  BCRYPT_ROUNDS,
  UNIQUE_CONSTRAINT_MESSAGES,
};