import repositories from "../repository/init";
import MasterController from "./master-controllers";

export default class SessionControllers extends MasterController{
    constructor(){
        super(new repositories.SessionRepository());
    }
}