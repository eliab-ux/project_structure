export default function validate(fieldCheck, fieldsToCheck) {
  let valid = true;
  fieldsToCheck.forEach((field) => {
    if (!fieldCheck.hasOwnProperty(field)) valid = false;
  });

  return valid;
}
