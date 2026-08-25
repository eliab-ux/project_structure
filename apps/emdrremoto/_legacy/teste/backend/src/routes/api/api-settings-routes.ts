import ApiSettingsController from '../../controllers/api-settings-controllers';
import * as express from 'express'


const apiSettingsRoutes = express.Router();
const api_settings_controllers = new ApiSettingsController()

apiSettingsRoutes.get('/', api_settings_controllers.apiStatus)

export default apiSettingsRoutes