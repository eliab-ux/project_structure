import Cookies from "universal-cookie";
export default class CookiesProvider{
   private cookies: Cookies;
   constructor() {
       this.cookies = new Cookies();
   }

   public saveUserData = (user_data:any) => {
       const {token, user} = user_data;
       const data = {
           token,user
       }
       this.cookies.set('user-data',data);
   }
   public logout = () => {
       this.cookies.remove('user-data')
   }
   public getUserData = () => {
       return this.cookies.get('user-data')
   }
}