Feature: Logout

Scenario: Logged user can logout and is redirected to login
  Given I am logged in with a newly registered user
  When I click the logout button
  Then I should be redirected to the login page
  And I should not be authenticated