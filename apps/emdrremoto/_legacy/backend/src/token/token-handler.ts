require("dotenv/config");
const jwt = require("jsonwebtoken");

/**
 *
 * Cria token para o usuário
 *
 * @param payload
 * @returns jwt_token
 */
export default function createNewToken(payload: any) {
  let doc = {
    userID: payload.userID,
  };
  const token = jwt.sign(doc, process.env.SECRET_KEY, { expiresIn: "10h" });
  return token;
}

/**
 *
 * Autentica token
 * @param token
 * @returns boolean || jwt_token_data
 */
export function verifyToken(token) {
  let verifier = jwt.verify(
    token,
    process.env.SECRET_KEY,
    (err, decoded_data) => {
      if (err) {
        return false;
      }
      return decoded_data;
    }
  );
  return verifier;
}
