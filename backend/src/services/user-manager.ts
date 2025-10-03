import { generateToken } from "../utils/utils";

class UserManager {

    createToken(): string {
        return generateToken();
    }
}

const userManager = new UserManager();

export default userManager;
export { UserManager };